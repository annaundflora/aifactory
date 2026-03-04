# Slice 15: Download als PNG

> **Slice 15 von 21** fuer `E2E Generate & Persist`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-15-download-png` |
| **Test** | `pnpm test lib/__tests__/download-utils.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-12-lightbox-modal"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/__tests__/download-utils.test.ts` |
| **Integration Command** | -- |
| **Acceptance Command** | -- |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `localhost:3000` |
| **Mocking Strategy** | `mock_external` (fetch gemockt, kein echter Netzwerkzugriff in Tests) |

---

## Ziel

Download-Button in der Lightbox implementieren, der das aktuell angezeigte Bild als PNG-Datei im Browser herunterlaed. Der Download erfolgt client-seitig via fetch + Blob + programmatischem Anchor-Klick.

---

## Acceptance Criteria

1) GIVEN eine geoeffnete Lightbox mit einer Generation die `image_url: "https://r2.example.com/projects/abc/img.png"` und `prompt: "A fox in oil painting style"` hat
   WHEN der User auf den "Download PNG" Button klickt
   THEN wird ein Browser-Download gestartet mit dem Bild von der `image_url`

2) GIVEN eine Generation mit `prompt: "A fox in oil painting style, warm colors"` und `created_at: "2026-03-02T14:32:00Z"`
   WHEN der Download-Dateiname generiert wird
   THEN lautet der Dateiname `a-fox-in-oil-painting-style-warm-colors_2026-03-02.png` (slugified prompt, max 60 Zeichen vor dem Datum, Sonderzeichen entfernt, Kleinbuchstaben)

3) GIVEN eine Generation mit einem sehr langen Prompt (>60 Zeichen)
   WHEN der Download-Dateiname generiert wird
   THEN wird der Prompt auf maximal 60 Zeichen gekuerzt (am letzten Wort-Ende vor dem Limit) und mit `_{datum}.png` ergaenzt

4) GIVEN der Download-Button wurde geklickt
   WHEN der fetch-Request fuer das Bild laeuft
   THEN zeigt der Button einen Loading-State (z.B. Spinner) und ist waehrend des Downloads disabled

5) GIVEN der Download-Button wurde geklickt
   WHEN der fetch-Request erfolgreich abgeschlossen ist
   THEN wird der Loading-State entfernt und der Button ist wieder klickbar

6) GIVEN der fetch-Request fuer das Bild schlaegt fehl (z.B. Netzwerkfehler)
   WHEN der Fehler auftritt
   THEN wird eine Toast-Notification mit "Download fehlgeschlagen" angezeigt und der Button kehrt in den Default-State zurueck

7) GIVEN eine `downloadImage` Utility-Funktion in `lib/utils.ts`
   WHEN sie mit `url: string` und `filename: string` aufgerufen wird
   THEN fuehrt sie fetch(url) aus, erstellt einen Blob, erzeugt eine Object-URL, triggert einen programmatischen Anchor-Klick und raeumt die Object-URL via `revokeObjectURL` wieder auf

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes `it.todo()` referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/__tests__/download-utils.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('downloadImage', () => {
  // AC-7: fetch + Blob + Anchor-Klick + revokeObjectURL
  it.todo('should fetch the image URL, create a blob, trigger anchor click, and revoke object URL')

  // AC-6: Fehlerbehandlung
  it.todo('should throw or reject when fetch fails')
})

describe('generateDownloadFilename', () => {
  // AC-2: Dateiname aus Prompt + Datum
  it.todo('should generate slugified filename from prompt and created_at date')

  // AC-3: Langer Prompt wird gekuerzt
  it.todo('should truncate prompt to max 60 characters at last word boundary')

  // AC-2: Sonderzeichen entfernt
  it.todo('should remove special characters and convert to lowercase')
})
```
</test_spec>

### Test-Datei: `components/lightbox/__tests__/download-button.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('Download PNG Button in Lightbox', () => {
  // AC-1: Download wird gestartet
  it.todo('should call downloadImage with correct URL when Download PNG button is clicked')

  // AC-4: Loading-State waehrend Download
  it.todo('should show loading state and be disabled while download is in progress')

  // AC-5: Loading-State entfernt nach Download
  it.todo('should return to default state after successful download')

  // AC-6: Toast bei Fehler
  it.todo('should show error toast when download fails')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-12` | `LightboxModal` | React Component | Lightbox rendert Generation mit `image_url`, `prompt`, `created_at` |
| `slice-12` | `Generation` Type | Type | Benoetigt `image_url: string`, `prompt: string`, `created_at: Date` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `downloadImage` | Utility Function | -- | `(url: string, filename: string) => Promise<void>` |
| `generateDownloadFilename` | Utility Function | -- | `(prompt: string, createdAt: Date) => string` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/utils.ts` -- `downloadImage` und `generateDownloadFilename` Helper-Funktionen hinzufuegen
- [ ] `components/lightbox/lightbox-modal.tsx` -- Download PNG Button mit Loading-State und Toast-Fehlerbehandlung integrieren
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Server Action -- Download ist rein client-seitig (fetch + Blob)
- KEINE Bild-Konvertierung -- Bilder sind bereits als PNG in R2 gespeichert
- KEINE Batch-Downloads -- nur einzelnes Bild pro Klick
- KEIN neuer Download-Dialog -- nutzt nativen Browser-Download

**Technische Constraints:**
- Client-seitig: `fetch(url)` → `response.blob()` → `URL.createObjectURL()` → programmatischer `<a>` Klick → `URL.revokeObjectURL()`
- Dateiname: Slugified Prompt (max 60 Zeichen, am Wort-Ende gekuerzt) + `_YYYY-MM-DD.png`
- Toast via sonner (bereits in App vorhanden)
- Download-Button als Teil der Actions-Section in der Lightbox

**Referenzen:**
- Wireframes: `wireframes.md` → Section "Screen: Lightbox / Image Detail Modal", Annotation 7 (`download-btn`)
- Wireframes: `wireframes.md` → State Variation `downloading` (Button zeigt Spinner)
- Discovery: `discovery.md` → Section "User Flow" → Flow 6 (Bild herunterladen)
- Discovery: `discovery.md` → Section "UI Components & States" → `download-btn` (States: `default`, `downloading`)
- Architecture: `architecture.md` → Section "Constraints" → "Download-Format immer PNG"
