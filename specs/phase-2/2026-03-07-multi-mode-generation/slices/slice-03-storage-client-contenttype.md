# Slice 03: Storage Client — Dynamischer ContentType

> **Slice 3 von 6** für `Multi-Mode Generation (img2img + Upscale)`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-03-storage-client-contenttype` |
| **Test** | `pnpm test lib/clients/__tests__/storage.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `[]` |

---

## Test-Strategy (für Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/clients/__tests__/storage.test.ts` |
| **Integration Command** | `pnpm test lib/clients/__tests__/` |
| **Acceptance Command** | — |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (S3Client via vi.mock, kein echter R2-Zugriff) |

---

## Ziel

Die `upload()`-Funktion in `lib/clients/storage.ts` erhält einen optionalen `contentType`-Parameter. Wird er weggelassen, bleibt `"image/png"` der Default — kein Breaking Change für bestehende Aufrufer. Source-Images (JPEG, WebP) können damit mit korrektem `ContentType`-Header hochgeladen werden.

---

## Acceptance Criteria

1) GIVEN ein Aufruf von `upload(stream, key)` ohne dritten Parameter
   WHEN `PutObjectCommand` an den S3-Client gesendet wird
   THEN enthält der Command `ContentType: "image/png"`

2) GIVEN ein Aufruf von `upload(stream, key, "image/jpeg")`
   WHEN `PutObjectCommand` an den S3-Client gesendet wird
   THEN enthält der Command `ContentType: "image/jpeg"`

3) GIVEN ein Aufruf von `upload(stream, key, "image/webp")`
   WHEN `PutObjectCommand` an den S3-Client gesendet wird
   THEN enthält der Command `ContentType: "image/webp"`

4) GIVEN die geänderte `upload()`-Signatur
   WHEN TypeScript die Aufruf-Stellen prüft, die den dritten Parameter weglassen (z.B. in `generation-service.ts`)
   THEN kompilieren alle bestehenden Aufruf-Stellen ohne Fehler (kein Breaking Change)

5) GIVEN ein Aufruf von `upload(stream, key, "image/jpeg")`
   WHEN der Upload erfolgreich ist
   THEN gibt die Funktion dieselbe öffentliche URL zurück wie bisher (`${publicUrl}/${key}`)

---

## Test Skeletons

> **Für den Test-Writer-Agent:** Jedes Skeleton referenziert ein AC. Der Test-Writer implementiert die Assertions via `vi.mock` für `@aws-sdk/client-s3`. Der S3Client-Mock muss `send()` als `vi.fn()` bereitstellen; der aufgerufene Command kann über `expect(mockSend).toHaveBeenCalledWith(expect.objectContaining(...))` geprüft werden.

### Test-Datei: `lib/clients/__tests__/storage.test.ts`

<test_spec>
```typescript
// AC-1: Default ContentType bleibt image/png wenn Parameter fehlt
it.todo('should send PutObjectCommand with ContentType image/png when contentType is omitted')

// AC-2: Dynamischer ContentType image/jpeg wird durchgereicht
it.todo('should send PutObjectCommand with ContentType image/jpeg when specified')

// AC-3: Dynamischer ContentType image/webp wird durchgereicht
it.todo('should send PutObjectCommand with ContentType image/webp when specified')

// AC-4: Bestehende Aufrufer ohne dritten Parameter kompilieren weiterhin
it.todo('should compile without error when called with only stream and key (backwards compatibility)')

// AC-5: Rueckgabewert ist unveraendert public URL
it.todo('should return correct public URL regardless of contentType parameter')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| — | — | — | Keine Abhängigkeiten; läuft unabhängig |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `upload` | Function | `slice-04-generation-service` | `(stream: ReadableStream \| Buffer, key: string, contentType?: string) => Promise<string>` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/clients/storage.ts` — `upload()`-Signatur um optionalen dritten Parameter `contentType?: string` erweitern; Default `"image/png"` beibehalten; `PutObjectCommand` nutzt den Parameter statt des Hardcoded-Strings
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehören NICHT in Deliverables. Der Test-Writer-Agent erstellt `lib/clients/__tests__/storage.test.ts` basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Nur die `upload()`-Funktion wird geändert — `deleteObject`, `StorageService`, `getConfig`, `createS3Client` bleiben unberührt
- Keine Validierung erlaubter MIME-Types — das ist Aufgabe des Action-Layers (architecture.md → Section "Validation Rules")
- Kein neuer Env-Var oder Konfigurations-Parameter

**Technische Constraints:**
- Parameter ist optional mit Default: `contentType: string = "image/png"` — kein Overloading nötig
- `PutObjectCommand` nutzt den Parameter direkt; kein Caching oder Transformation des Werts
- Bestehende Fehlerbehandlung (stream-read-Fehler, R2-Upload-Fehler) bleibt unverändert

**Referenzen:**
- Bestehende `upload()`-Implementierung: `lib/clients/storage.ts` Zeilen 79–113
- Verwendungskontext Source-Image-Upload: `architecture.md` → Section "Server Logic → Services & Processing" (SourceImageService)
- Migration Map Eintrag: `architecture.md` → Section "Migration Map" (Zeile `lib/clients/storage.ts`)
