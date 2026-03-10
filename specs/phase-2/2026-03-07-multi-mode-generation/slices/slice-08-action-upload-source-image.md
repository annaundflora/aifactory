# Slice 08: Server Action — uploadSourceImage

> **Slice 8 von N** für `Multi-Mode Generation (img2img + Upscale)`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-08-action-upload-source-image` |
| **Test** | `pnpm test app/actions/__tests__/generations.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-03-storage-client-contenttype"]` |

---

## Test-Strategy (für Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test app/actions/__tests__/generations.test.ts` |
| **Integration Command** | `pnpm test app/actions/__tests__/` |
| **Acceptance Command** | — |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (StorageService via vi.mock, kein echter R2-Zugriff) |

---

## Ziel

Neue Server Action `uploadSourceImage` in `app/actions/generations.ts` hinzufügen. Sie validiert Dateityp (PNG/JPG/JPEG/WebP) und Dateigröße (max 10 MB), lädt das Bild unter `sources/{projectId}/{uuid}.{ext}` in R2 hoch und gibt die öffentliche URL zurück. Fehler werden als `{ error: string }` zurückgegeben — kein Throw.

---

## Acceptance Criteria

1) GIVEN eine `File`-Instanz vom Typ `image/png` mit 5 MB und gültigem `projectId`
   WHEN `uploadSourceImage({ projectId, file })` aufgerufen wird
   THEN gibt die Action `{ url: string }` zurück, wobei `url` mit dem R2-Public-URL-Präfix beginnt und den Pfad `sources/{projectId}/` enthält

2) GIVEN eine `File`-Instanz vom Typ `image/jpeg` mit 2 MB und gültigem `projectId`
   WHEN `uploadSourceImage({ projectId, file })` aufgerufen wird
   THEN gibt die Action `{ url: string }` zurück (JPEG-Dateityp wird akzeptiert)

3) GIVEN eine `File`-Instanz vom Typ `image/webp` mit 3 MB und gültigem `projectId`
   WHEN `uploadSourceImage({ projectId, file })` aufgerufen wird
   THEN gibt die Action `{ url: string }` zurück (WebP-Dateityp wird akzeptiert)

4) GIVEN eine `File`-Instanz vom Typ `image/gif` (nicht erlaubt)
   WHEN `uploadSourceImage({ projectId, file })` aufgerufen wird
   THEN gibt die Action `{ error: "Nur PNG, JPG, JPEG und WebP erlaubt" }` zurück, ohne R2 aufzurufen

5) GIVEN eine `File`-Instanz vom Typ `application/pdf` (nicht erlaubt)
   WHEN `uploadSourceImage({ projectId, file })` aufgerufen wird
   THEN gibt die Action `{ error: "Nur PNG, JPG, JPEG und WebP erlaubt" }` zurück, ohne R2 aufzurufen

6) GIVEN eine `File`-Instanz vom Typ `image/png` mit 11 MB (über dem Limit)
   WHEN `uploadSourceImage({ projectId, file })` aufgerufen wird
   THEN gibt die Action `{ error: "Datei darf maximal 10MB groß sein" }` zurück, ohne R2 aufzurufen

7) GIVEN eine `File`-Instanz vom Typ `image/png` mit exakt 10 MB (Grenzwert)
   WHEN `uploadSourceImage({ projectId, file })` aufgerufen wird
   THEN gibt die Action `{ url: string }` zurück (Grenzwert ist erlaubt)

8) GIVEN eine gültige Datei, aber `StorageService.upload()` wirft einen Fehler
   WHEN `uploadSourceImage({ projectId, file })` aufgerufen wird
   THEN gibt die Action `{ error: "Bild konnte nicht hochgeladen werden" }` zurück und loggt den Fehler mit `console.error`

9) GIVEN eine gültige PNG-Datei mit `projectId`
   WHEN `uploadSourceImage` die Datei an `StorageService.upload()` übergibt
   THEN wird `upload()` mit dem Key `sources/{projectId}/{uuid}.png` und `contentType: "image/png"` aufgerufen

10) GIVEN eine gültige JPEG-Datei mit `projectId`
    WHEN `uploadSourceImage` die Datei an `StorageService.upload()` übergibt
    THEN wird `upload()` mit dem Key `sources/{projectId}/{uuid}.jpg` und `contentType: "image/jpeg"` aufgerufen

---

## Test Skeletons

> **Für den Test-Writer-Agent:** Jedes Skeleton referenziert ein AC. Der Test-Writer mockt `StorageService` via `vi.mock('@/lib/clients/storage')` und erstellt `File`-Instanzen über `new File([buffer], 'name.png', { type: 'image/png' })`. Der Test-Writer implementiert die Assertions selbstständig.

### Test-Datei: `app/actions/__tests__/generations.test.ts`

<test_spec>
```typescript
// AC-1: Gültiges PNG wird hochgeladen und URL zurückgegeben
it.todo('should upload valid PNG and return url')

// AC-2: Gültiges JPEG wird akzeptiert
it.todo('should upload valid JPEG and return url')

// AC-3: Gültiges WebP wird akzeptiert
it.todo('should upload valid WebP and return url')

// AC-4: GIF wird abgelehnt mit korrekter Fehlermeldung
it.todo('should reject GIF with error "Nur PNG, JPG, JPEG und WebP erlaubt"')

// AC-5: PDF wird abgelehnt mit korrekter Fehlermeldung
it.todo('should reject PDF with error "Nur PNG, JPG, JPEG und WebP erlaubt"')

// AC-6: Datei über 10MB wird abgelehnt
it.todo('should reject file over 10MB with error "Datei darf maximal 10MB groß sein"')

// AC-7: Datei mit exakt 10MB wird akzeptiert
it.todo('should accept file at exactly 10MB limit')

// AC-8: StorageService-Fehler → strukturierter Error-Return
it.todo('should return error object when StorageService.upload throws')

// AC-9: R2-Key-Format für PNG ist korrekt (sources/{projectId}/{uuid}.png)
it.todo('should call StorageService.upload with correct key format and contentType for PNG')

// AC-10: R2-Key-Format für JPEG ist korrekt (sources/{projectId}/{uuid}.jpg)
it.todo('should call StorageService.upload with correct key format and contentType for JPEG')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-03-storage-client-contenttype` | `StorageService.upload` | Function | Signatur `(stream, key, contentType?) => Promise<string>` — dritter Parameter muss vorhanden sein |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `uploadSourceImage` | Server Action | UI (PromptArea img2img-Mode) | `({ projectId: string, file: File }) => Promise<{ url: string } \| { error: string }>` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `app/actions/generations.ts` — neue `uploadSourceImage` Action hinzufügen; Datei bleibt `"use server"`; bestehende Actions (`generateImages`, `retryGeneration`, `fetchGenerations`, `deleteGeneration`) bleiben unverändert
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehören NICHT in Deliverables. Der Test-Writer-Agent erstellt `app/actions/__tests__/generations.test.ts` basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Kein neues Service-File — `SourceImageService`-Logik wird inline in der Action oder als privater Helper in `generations.ts` implementiert
- Keine Änderung an `generateImages`, `retryGeneration`, `fetchGenerations`, `deleteGeneration`
- Kein URL-Paste-Flow (URL als Source-Image-Input ist separater Scope)
- Keine Client-seitige Upload-Progress-Logik (Server Action, kein Streaming)

**Technische Constraints:**
- Erlaubte MIME-Types: `image/png`, `image/jpeg`, `image/webp` — Prüfung über `file.type`
- Größengrenze: `10 * 1024 * 1024` Bytes (10 MB) — Prüfung über `file.size`
- R2-Key-Pfad: `sources/{projectId}/{uuid}.{ext}` — UUID via `crypto.randomUUID()`
- Erweiterung der `contentType`-Unterstützung aus slice-03: JPEG-Upload mit `"image/jpeg"`, WebP mit `"image/webp"`, PNG mit `"image/png"`
- Fehlerbehandlung: kein Throw nach außen, immer `{ error: string }` zurückgeben; R2-Fehler mit `console.error` loggen

**Referenzen:**
- Validation Rules: `architecture.md` → Section "Validation Rules" (Source file type / size Zeilen)
- SourceImageService-Konzept: `architecture.md` → Section "Server Logic → Services & Processing"
- Error Handling: `architecture.md` → Section "Error Handling Strategy" (Invalid file type/size + R2 upload failure)
- R2-Key-Muster: `architecture.md` → Section "Scope & Boundaries" (`sources/{projectId}/{id}`)
