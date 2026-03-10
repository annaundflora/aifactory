# Slice 09: Server Actions — generateImages img2img + upscaleImage

> **Slice 9 von N** für `Multi-Mode Generation (img2img + Upscale)`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-09-action-generate-upscale` |
| **Test** | `pnpm test app/actions/__tests__/generations.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-06-generation-service-img2img", "slice-07-generation-service-upscale", "slice-08-action-upload-source-image"]` |

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
| **Mocking Strategy** | `mock_external` (GenerationService via vi.mock — kein echter DB- oder Replicate-Zugriff) |

---

## Ziel

`generateImages` wird um die optionalen Felder `generationMode`, `sourceImageUrl` und `strength` erweitert und validiert mode-spezifische Eingaben bevor an `GenerationService.generate()` delegiert wird. Neue Action `upscaleImage` validiert `scale` und `sourceImageUrl` und delegiert an `GenerationService.upscale()`. Beide Actions liegen in `app/actions/generations.ts` und geben bei Fehlern `{ error: string }` zurück — kein Throw.

---

## Acceptance Criteria

1) GIVEN `generateImages` wird mit `generationMode: "img2img"` aber ohne `sourceImageUrl` aufgerufen
   WHEN die Action die Eingaben validiert
   THEN gibt sie `{ error: "Source-Image ist erforderlich fuer img2img" }` zurück und ruft `GenerationService.generate()` nicht auf

2) GIVEN `generateImages` wird mit `generationMode: "img2img"`, einer gültigen `sourceImageUrl` und `strength: 1.5` aufgerufen
   WHEN die Action die Eingaben validiert
   THEN gibt sie `{ error: "Strength muss zwischen 0 und 1 liegen" }` zurück und ruft `GenerationService.generate()` nicht auf

3) GIVEN `generateImages` wird mit `generationMode: "img2img"`, einer gültigen `sourceImageUrl` und `strength: -0.1` aufgerufen
   WHEN die Action die Eingaben validiert
   THEN gibt sie `{ error: "Strength muss zwischen 0 und 1 liegen" }` zurück und ruft `GenerationService.generate()` nicht auf

4) GIVEN `generateImages` wird mit `generationMode: "img2img"`, `sourceImageUrl: "https://r2.example.com/sources/p1/abc.png"` und `strength: 0.6` aufgerufen
   WHEN die Validierung erfolgreich ist
   THEN delegiert die Action an `GenerationService.generate()` mit den Feldern `generationMode`, `sourceImageUrl` und `strength` und gibt das Ergebnis (Generation[]) zurück

5) GIVEN `generateImages` wird ohne `generationMode` aufgerufen (bestehender txt2img-Call)
   WHEN die Action delegiert
   THEN ruft sie `GenerationService.generate()` auf ohne Validierungsfehler; bestehende Tests bleiben grün

6) GIVEN `upscaleImage` wird mit `scale: 3` (ungültig) aufgerufen
   WHEN die Action die Eingaben validiert
   THEN gibt sie `{ error: "Scale muss 2 oder 4 sein" }` zurück und ruft `GenerationService.upscale()` nicht auf

7) GIVEN `upscaleImage` wird ohne `sourceImageUrl` aufgerufen
   WHEN die Action die Eingaben validiert
   THEN gibt sie `{ error: "Source-Image ist erforderlich fuer img2img" }` zurück und ruft `GenerationService.upscale()` nicht auf

8) GIVEN `upscaleImage` wird mit `{ projectId, sourceImageUrl: "https://r2.example.com/img.png", scale: 2 }` aufgerufen
   WHEN die Validierung erfolgreich ist
   THEN delegiert die Action an `GenerationService.upscale()` mit allen übergebenen Feldern und gibt das zurückgegebene `Generation`-Objekt zurück

9) GIVEN `upscaleImage` wird mit `{ projectId, sourceImageUrl, scale: 4, sourceGenerationId: "uuid-123" }` aufgerufen
   WHEN die Validierung erfolgreich ist
   THEN delegiert die Action an `GenerationService.upscale()` mit `sourceGenerationId: "uuid-123"`

10) GIVEN `GenerationService.upscale()` wirft einen Fehler während eines validen `upscaleImage`-Aufrufs
    WHEN die Action den Fehler erhält
    THEN gibt sie `{ error: string }` zurück und loggt mit `console.error` — kein Throw nach außen

---

## Test Skeletons

> **Für den Test-Writer-Agent:** Jedes Skeleton referenziert ein AC. Der Test-Writer mockt `GenerationService` via `vi.mock('@/lib/services/generation-service')`. Bestehende Mock-Patterns in `app/actions/__tests__/generations.test.ts` übernehmen.

### Test-Datei: `app/actions/__tests__/generations.test.ts`

<test_spec>
```typescript
// AC-1: img2img ohne sourceImageUrl → Validierungsfehler
it.todo('should return error when generationMode is img2img and sourceImageUrl is missing')

// AC-2: img2img mit strength > 1 → Validierungsfehler
it.todo('should return error when strength is greater than 1')

// AC-3: img2img mit strength < 0 → Validierungsfehler
it.todo('should return error when strength is less than 0')

// AC-4: Gültiger img2img-Input → delegiert an GenerationService.generate
it.todo('should call GenerationService.generate with generationMode, sourceImageUrl and strength for img2img')

// AC-5: Bestehender txt2img-Aufruf ohne generationMode → kein Validierungsfehler
it.todo('should delegate to GenerationService.generate without error when generationMode is absent')

// AC-6: upscaleImage mit scale 3 → Validierungsfehler
it.todo('should return error when scale is not 2 or 4')

// AC-7: upscaleImage ohne sourceImageUrl → Validierungsfehler
it.todo('should return error when sourceImageUrl is missing in upscaleImage')

// AC-8: Gültiger upscaleImage-Input (scale 2) → delegiert an GenerationService.upscale
it.todo('should call GenerationService.upscale with correct args and return Generation')

// AC-9: upscaleImage mit sourceGenerationId → wird an GenerationService.upscale weitergegeben
it.todo('should pass sourceGenerationId to GenerationService.upscale when provided')

// AC-10: GenerationService.upscale wirft → strukturierter Error-Return
it.todo('should return error object when GenerationService.upscale throws')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-06-generation-service-img2img` | `GenerationService.generate` | Function | Akzeptiert `generationMode?`, `sourceImageUrl?`, `strength?` als optionale Parameter |
| `slice-07-generation-service-upscale` | `GenerationService.upscale` | Function | Signatur `(input: UpscaleInput) => Promise<Generation>` |
| `slice-08-action-upload-source-image` | `uploadSourceImage` | Server Action | Liefert `{ url: string }` — `sourceImageUrl` stammt aus diesem Return-Wert |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `generateImages` | Server Action | UI (PromptArea img2img-Mode) | `(input: GenerateImagesInput) => Promise<Generation[] \| { error: string }>` |
| `upscaleImage` | Server Action | UI (PromptArea Upscale-Mode, Lightbox) | `(input: { projectId: string, sourceImageUrl: string, scale: 2 \| 4, sourceGenerationId?: string }) => Promise<Generation \| { error: string }>` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `app/actions/generations.ts` — `generateImages` um Felder `generationMode`, `sourceImageUrl?`, `strength?` erweitern + Validierung; neue Action `upscaleImage` mit Validierung für `scale` (2|4) und `sourceImageUrl`; Delegation an `GenerationService`; Fehler als `{ error: string }` zurückgeben
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehören NICHT in Deliverables. Der Test-Writer-Agent erweitert `app/actions/__tests__/generations.test.ts` basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Keine Änderungen an `retryGeneration`, `fetchGenerations`, `deleteGeneration`
- Keine Business-Logik im Action-Layer — Validierung ja, Prompt-Komposition nein (liegt im Service)
- Kein neuer Service-File — Delegation geht direkt an `GenerationService`
- Kein URL-Paste-Flow für Source-Images (Out of Scope laut architecture.md)

**Technische Constraints:**
- Datei bleibt `"use server"` am Anfang
- `generationMode` Validierung: erlaubt sind `"txt2img"`, `"img2img"`, `"upscale"` — wenn übergeben
- `strength`-Prüfung nur wenn `generationMode === "img2img"` und `strength !== undefined`
- Fehlerbehandlung: kein Throw nach außen, immer `{ error: string }` — `console.error` für unerwartete Service-Fehler
- Backwards-Kompatibilität: bestehende `generateImages`-Aufrufer ohne neue Felder funktionieren unverändert

**Referenzen:**
- Validation Rules (Fehlermeldungen, Wertebereiche): `architecture.md` → Section "Server Logic → Validation Rules"
- DTO-Definitionen `GenerateImagesInput` und `UpscaleImageInput`: `architecture.md` → Section "API Design → DTOs"
- Error Handling Strategy: `architecture.md` → Section "Error Handling Strategy"
- Server Actions Übersicht: `architecture.md` → Section "API Design → Server Actions"
