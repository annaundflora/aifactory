# Slice 12: ImageDropzone Component

> **Slice 12 von N** für `Multi-Mode Generation (img2img + Upscale)`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-12-image-dropzone-component` |
| **Test** | `pnpm test components/workspace/__tests__/image-dropzone.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-08-action-upload-source-image"]` |

---

## Test-Strategy (für Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/workspace/__tests__/image-dropzone.test.tsx` |
| **Integration Command** | `pnpm test components/workspace/__tests__/` |
| **Acceptance Command** | — |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (`uploadSourceImage` Action via `vi.mock('@/app/actions/generations')`) |

---

## Ziel

Neue Client-Komponente `ImageDropzone` mit fünf klar abgegrenzten States (empty, drag-over, uploading, preview, error). Die Komponente nimmt Bilder per Drag & Drop, Click-to-Browse oder URL-Paste entgegen, ruft intern `uploadSourceImage` auf und gibt die R2-URL via `onUpload`-Callback zurück. Sie ist eigenständig und in sich geschlossen — keine externe State-Koordination ausser dem `onUpload`-Callback und dem `projectId`-Prop.

---

## Acceptance Criteria

1) GIVEN `ImageDropzone` ohne vorherigen Upload gerendert wird
   WHEN die Komponente im DOM erscheint
   THEN ist der `empty`-State sichtbar: Dashed-Border-Container mit den Texten "Drop image here", "or click to upload" und "or paste URL"; kein Thumbnail, kein Remove-Button

2) GIVEN `ImageDropzone` im `empty`-State
   WHEN eine Datei über die Dropzone gezogen wird (dragover-Event)
   THEN wechselt die Komponente in den `drag-over`-State: Border-Highlighting sichtbar (andere Farbe oder stärkerer Border als im `empty`-State)

3) GIVEN `ImageDropzone` im `drag-over`-State
   WHEN die Datei die Dropzone verlässt (dragleave-Event)
   THEN kehrt die Komponente in den `empty`-State zurück

4) GIVEN `ImageDropzone` im `empty`-State und `uploadSourceImage` resolvet nach 100ms mit `{ url: "https://r2.example.com/sources/p1/abc.png" }`
   WHEN eine gültige PNG-Datei per Drop abgelegt wird
   THEN wechselt die Komponente sofort in den `uploading`-State (Progress-Indikator sichtbar, kein Thumbnail); nach dem Resolve wechselt sie in den `preview`-State

5) GIVEN `ImageDropzone` im `preview`-State nach erfolgreichem Upload
   WHEN der State gerendert wird
   THEN sind sichtbar: Thumbnail (`<img>`), Dateiname der hochgeladenen Datei, Bildabmessungen in Format "WIDTHxHEIGHT" und ein Remove-Button [✕]; kein Dashed-Border-Platzhalter

6) GIVEN `ImageDropzone` im `preview`-State
   WHEN der Remove-Button [✕] geklickt wird
   THEN wechselt die Komponente zurück in den `empty`-State; `onUpload` wird mit `null` aufgerufen; Thumbnail und Dateiname sind nicht mehr im DOM

7) GIVEN `uploadSourceImage` resolvet mit `{ error: "Nur PNG, JPG, JPEG und WebP erlaubt" }`
   WHEN eine Datei per Drop abgelegt wird
   THEN wechselt die Komponente in den `error`-State: Fehlermeldung "Nur PNG, JPG, JPEG und WebP erlaubt" ist im Container sichtbar; `onUpload` wird nicht mit einer URL aufgerufen

8) GIVEN `uploadSourceImage` resolvet mit `{ error: "Datei darf maximal 10MB groß sein" }`
   WHEN eine Datei per Drop abgelegt wird
   THEN wechselt die Komponente in den `error`-State: Fehlermeldung "Datei darf maximal 10MB groß sein" ist im Container sichtbar

9) GIVEN `ImageDropzone` im `error`-State
   WHEN der Nutzer erneut eine Datei per Drop oder Click-to-Browse eingibt
   THEN wechselt die Komponente sofort in den `uploading`-State (error-State wird verlassen)

10) GIVEN `ImageDropzone` mit einem `onUpload`-Spy und `uploadSourceImage` resolvet mit `{ url: "https://r2.example.com/sources/p1/abc.png" }`
    WHEN ein Upload per Drop abgeschlossen wird
    THEN wird `onUpload` einmal mit dem exakten Argument `"https://r2.example.com/sources/p1/abc.png"` aufgerufen

11) GIVEN `ImageDropzone` im `empty`-State
    WHEN der Nutzer auf den Dropzone-Bereich klickt
    THEN wird ein File-Picker-Dialog geöffnet (hidden `<input type="file">` erhält `.click()`); nach Dateiauswahl startet der Upload-Zyklus identisch zum Drop-Flow

12) GIVEN `ImageDropzone` im `empty`-State mit einem URL-Eingabefeld
    WHEN der Nutzer einen String, der mit "http" beginnt, in das Eingabefeld einfügt (paste-Event)
    THEN ruft die Komponente `uploadSourceImage` mit `{ projectId, file }` auf und wechselt in den `uploading`-State; der Flow ist identisch zum Drop-Flow

---

## Test Skeletons

> **Für den Test-Writer-Agent:** Tests nutzen `@testing-library/react` + `userEvent`. `uploadSourceImage` wird via `vi.mock('@/app/actions/generations')` gemockt. `URL.createObjectURL` muss via `vi.stubGlobal` gemockt werden. Der Test-Writer implementiert alle Assertions selbstständig.

### Test-Datei: `components/workspace/__tests__/image-dropzone.test.tsx`

<test_spec>
```typescript
// AC-1: empty-State zeigt Platzhalter-Texte, kein Thumbnail
it.todo('should render empty state with dropzone placeholder text and no thumbnail')

// AC-2: drag-over wechselt State zu drag-over mit Border-Highlighting
it.todo('should switch to drag-over state when file is dragged over the dropzone')

// AC-3: dragleave kehrt zu empty zurück
it.todo('should return to empty state when dragged file leaves the dropzone')

// AC-4: Drop einer gültigen Datei → uploading → preview State-Transition
it.todo('should transition through uploading to preview state after successful drop upload')

// AC-5: preview-State zeigt Thumbnail, Dateiname, Dimensionen, Remove-Button
it.todo('should show thumbnail, filename, dimensions and remove button in preview state')

// AC-6: Remove-Button setzt Komponente zurück in empty-State; onUpload(null)
it.todo('should return to empty state and call onUpload with null when remove button is clicked')

// AC-7: Upload-Fehler (Dateityp) zeigt error-State mit Fehlermeldung
it.todo('should show error state with file type error message when uploadSourceImage returns type error')

// AC-8: Upload-Fehler (Dateigrösse) zeigt error-State mit Fehlermeldung
it.todo('should show error state with size error message when uploadSourceImage returns size error')

// AC-9: error-State → neuer Drop startet uploading-State
it.todo('should transition from error state to uploading state on new file drop')

// AC-10: onUpload wird einmal mit der exakten R2-URL aufgerufen
it.todo('should call onUpload exactly once with the R2 url after successful upload')

// AC-11: Klick auf Dropzone öffnet File-Picker (hidden input erhält click)
it.todo('should trigger file input click when dropzone area is clicked')

// AC-12: URL-Paste startet Upload-Flow
it.todo('should call uploadSourceImage and enter uploading state when a URL starting with "http" is pasted')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-08-action-upload-source-image` | `uploadSourceImage` | Server Action | Signatur `({ projectId: string, file: File }) => Promise<{ url: string } \| { error: string }>` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `ImageDropzone` | Component | PromptArea (img2img-Mode, Upscale-Mode) | `({ projectId: string, onUpload: (url: string \| null) => void, initialUrl?: string }) => JSX.Element` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/workspace/image-dropzone.tsx` — Client-Komponente mit fünf States (empty, drag-over, uploading, preview, error); Drag & Drop + Click-to-Browse + URL-Paste; ruft `uploadSourceImage` auf; gibt R2-URL via `onUpload`-Callback zurück
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehören NICHT in Deliverables. Der Test-Writer-Agent erstellt `components/workspace/__tests__/image-dropzone.test.tsx` basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Keine Integration in `PromptArea` — das ist Aufgabe eines späteren Slice
- Kein `StrengthSlider`, kein `ScaleSelector` — separate Komponenten
- Kein URL-Fetch auf dem Client — URL-Paste übergibt die URL als `File`-Wrapper oder direkt an `uploadSourceImage`; Re-Upload nach R2 erfolgt server-seitig (SSRF-Schutz, siehe architecture.md)
- Kein Batch-Upload (ein Bild gleichzeitig)
- Keine eigene Toast-Logik — Fehlermeldung wird im Dropzone-Container selbst angezeigt, kein Sonner-Aufruf

**Technische Constraints:**
- `"use client"` Direktive erforderlich
- Interne State-Machine mit genau fünf States: `empty | drag-over | uploading | preview | error`
- Bildabmessungen werden client-seitig via `onLoad`-Event auf einem `<img>`-Element ausgelesen, nicht via sharp
- `URL.createObjectURL` für lokale Thumbnail-Vorschau; nach Upload: Thumbnail aus R2-URL
- Akzeptierte MIME-Types im nativen File-Dialog: `accept="image/png,image/jpeg,image/webp"`
- `onUpload(null)` signalisiert dem Parent, dass kein Bild mehr vorliegt (nach Remove-Aktion)

**Referenzen:**
- State-Variationen: `wireframes.md` → "Screen: Prompt Area — Image to Image" → State Variations Tabelle
- Upscale-State-Variationen: `wireframes.md` → "Screen: Prompt Area — Upscale Mode" → State Variations Tabelle
- Validierungsregeln (Dateityp, Grösse): `architecture.md` → Section "Validation Rules"
- Error Handling Pattern: `architecture.md` → Section "Error Handling Strategy"
- Upload-Action-Signatur: `slice-08-action-upload-source-image.md` → Integration Contract → Provides
