# Slice 5: Gallery-as-Reference Service & Action implementieren

> **Slice 5 von 17** fuer `Multi-Image Referencing`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-05-gallery-as-reference` |
| **Test** | `pnpm test lib/services/__tests__/reference-service-gallery && pnpm test app/actions/__tests__/references-gallery` |
| **E2E** | `false` |
| **Dependencies** | `["slice-03-reference-service"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` (Next.js 16.1.6 + Drizzle ORM 0.45 + Vitest) |
| **Test Command** | `pnpm test lib/services/__tests__/reference-service-gallery` |
| **Integration Command** | `pnpm test app/actions/__tests__/references-gallery` |
| **Acceptance Command** | `pnpm test app/actions/__tests__/references-gallery` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | N/A |
| **Mocking Strategy** | `mock_external` (DB-Queries mocken, kein R2-Mock noetig da kein Upload stattfindet) |

---

## Ziel

Eine `uploadFromGallery`-Methode im ReferenceService bereitstellen, die Gallery-Bilder als Referenzen registriert, indem nur ein DB-Eintrag mit `sourceType: "gallery"` erstellt wird — ohne R2-Upload, da die bestehende Gallery-URL direkt genutzt wird. Zusaetzlich eine Server Action `addGalleryAsReference`, die diese Methode fuer die UI exponiert.

---

## Acceptance Criteria

1) GIVEN ein Gallery-Bild mit `generationId: "gen-abc-123"` und `imageUrl: "https://r2.example.com/generations/img.png"`
   WHEN `ReferenceService.uploadFromGallery({ projectId: "proj-xyz", generationId: "gen-abc-123", imageUrl: "https://r2.example.com/generations/img.png" })` aufgerufen wird
   THEN wird `createReferenceImage` mit `{ projectId: "proj-xyz", imageUrl: "https://r2.example.com/generations/img.png", sourceType: "gallery", sourceGenerationId: "gen-abc-123" }` aufgerufen und das zurueckgegebene Objekt enthaelt `{ id: "<UUID>", imageUrl, sourceType: "gallery", sourceGenerationId: "gen-abc-123" }`

2) GIVEN ein Aufruf von `ReferenceService.uploadFromGallery`
   WHEN die Methode ausgefuehrt wird
   THEN findet KEIN R2-Upload statt (kein Aufruf von `StorageService.upload`)

3) GIVEN ein Aufruf von `ReferenceService.uploadFromGallery` ohne `imageUrl` (leerer String)
   WHEN die Methode ausgefuehrt wird
   THEN wird ein Fehler geworfen mit Message "Bild-URL erforderlich"

4) GIVEN ein Aufruf von `ReferenceService.uploadFromGallery` ohne `generationId` (leerer String)
   WHEN die Methode ausgefuehrt wird
   THEN wird ein Fehler geworfen mit Message "Generation-ID erforderlich"

5) GIVEN ein Aufruf von `addGalleryAsReference` mit `{ projectId: "proj-xyz", generationId: "gen-abc-123", imageUrl: "https://r2.example.com/generations/img.png" }`
   WHEN die Server Action ausgefuehrt wird
   THEN wird `ReferenceService.uploadFromGallery` mit den gleichen Parametern aufgerufen und das Ergebnis `{ id: "<UUID>", imageUrl, sourceType: "gallery" }` zurueckgegeben

6) GIVEN ein Aufruf von `addGalleryAsReference` mit leerem `projectId`
   WHEN die Server Action ausgefuehrt wird
   THEN wird `{ error: "Ungueltige Projekt-ID" }` zurueckgegeben OHNE den Service aufzurufen

7) GIVEN `ReferenceService.uploadFromGallery` wirft einen Fehler mit Message "Bild-URL erforderlich"
   WHEN `addGalleryAsReference` ausgefuehrt wird
   THEN wird `{ error: "Bild-URL erforderlich" }` zurueckgegeben

8) GIVEN ein erfolgreicher `addGalleryAsReference`-Aufruf
   WHEN die Action abgeschlossen ist
   THEN wurde `revalidatePath("/")` aufgerufen

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/services/__tests__/reference-service-gallery.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('ReferenceService.uploadFromGallery', () => {
  // AC-1: Erstellt DB-Eintrag mit sourceType "gallery" und sourceGenerationId
  it.todo('should create a reference image with sourceType gallery and correct sourceGenerationId')

  // AC-2: Kein R2-Upload
  it.todo('should not call StorageService.upload')

  // AC-3: Leere imageUrl wird abgelehnt
  it.todo('should throw error for empty imageUrl')

  // AC-4: Leere generationId wird abgelehnt
  it.todo('should throw error for empty generationId')
})
```
</test_spec>

### Test-Datei: `app/actions/__tests__/references-gallery.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('addGalleryAsReference', () => {
  // AC-5: Delegiert an ReferenceService.uploadFromGallery und gibt Ergebnis zurueck
  it.todo('should call ReferenceService.uploadFromGallery and return result')

  // AC-6: Leere projectId wird abgelehnt
  it.todo('should return error for empty projectId without calling service')

  // AC-7: Service-Fehler wird als error-Objekt durchgereicht
  it.todo('should return error message from service when uploadFromGallery fails')

  // AC-8: revalidatePath wird bei Erfolg aufgerufen
  it.todo('should call revalidatePath after successful gallery reference creation')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| slice-02-reference-queries | `createReferenceImage` | Async Function | Import aus `lib/db/queries` verfuegbar |
| slice-03-reference-service | `ReferenceService` | Object Export | Import aus `lib/services/reference-service` verfuegbar, wird mit neuer Methode erweitert |
| (existing) | `revalidatePath` | Next.js Function | Import aus `next/cache` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `ReferenceService.uploadFromGallery` | Async Function | slice-14 (Gallery Drag), slice-16 (Lightbox Button) | `(input: { projectId: string, generationId: string, imageUrl: string }) => Promise<ReferenceImage>` |
| `addGalleryAsReference` | Server Action | slice-14 (Gallery Drag), slice-16 (Lightbox Button) | `(input: { projectId: string, generationId: string, imageUrl: string }) => Promise<ReferenceImage \| { error: string }>` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/services/reference-service.ts` — Erweitert: neue `uploadFromGallery()` Methode (kein R2-Upload, nur DB-Insert mit sourceType "gallery")
- [ ] `app/actions/references.ts` — Erweitert: neue `addGalleryAsReference` Server Action mit Input-Validierung und Service-Delegation
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE R2-Upload-Logik (Gallery-Bilder nutzen existierende URLs)
- KEINE MIME-Type- oder Groessen-Validierung (Bild existiert bereits im R2)
- KEINE Sharp-Dimensionsextraktion (width/height werden NICHT gesetzt, da kein File-Zugriff)
- KEINE UI-Komponenten (Lightbox-Button ist Slice 16, Gallery-Drag ist Slice 14)
- KEINE Aenderungen an bestehenden `upload()` oder `delete()` Methoden

**Technische Constraints:**
- `uploadFromGallery` wird als neue Methode am bestehenden `ReferenceService`-Objekt ergaenzt
- `addGalleryAsReference` wird in der bestehenden `app/actions/references.ts` Datei ergaenzt (neben `uploadReferenceImage` und `deleteReferenceImage` aus Slice 04)
- `sourceType` muss exakt `"gallery"` sein (nicht `"upload"`)
- `sourceGenerationId` ist PFLICHT (nicht optional wie bei `upload()`)
- Action-Pattern: `"use server"` Directive, `revalidatePath("/")` nach Mutation, `{ error }` Return bei Fehler — konsistent mit Slice 04

**Referenzen:**
- Architecture: `specs/phase-3/2026-03-11-multi-image-referencing/architecture.md` Section "Server Logic" (Zeile 142: `ReferenceService.uploadFromGallery`)
- Architecture: `architecture.md` Section "Server Actions" (Zeile 73: Action-Pattern)
- Slice 03: `reference-service.ts` — Service-Objekt das erweitert wird
- Slice 04: `references.ts` — Actions-Datei die erweitert wird
