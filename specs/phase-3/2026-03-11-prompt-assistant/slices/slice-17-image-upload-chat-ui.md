# Slice 17: Image Upload im Chat UI

> **Slice 17 von 22** fuer `Prompt Assistant`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-17-image-upload-chat-ui` |
| **Test** | `pnpm test components/assistant/__tests__/image-upload-button.test.tsx components/assistant/__tests__/image-preview.test.tsx components/assistant/__tests__/chat-input-image.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-16-analyze-image-tool"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

> **Quelle:** Auto-detected vom Slice-Writer Agent basierend auf Repo-Indikatoren.

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` (Next.js 16.1.6, React 19.2.3, pnpm, vitest) |
| **Test Command** | `pnpm test components/assistant/__tests__/image-upload-button.test.tsx components/assistant/__tests__/image-preview.test.tsx components/assistant/__tests__/chat-input-image.test.tsx` |
| **Integration Command** | `pnpm build` |
| **Acceptance Command** | `pnpm build` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (uploadSourceImage Server Action wird in Tests gemockt) |

---

## Ziel

Image-Upload-Button im Chat-Input aktivieren (ersetzt den Placeholder aus Slice 09). Klick oeffnet einen File-Picker (JPEG, PNG, WebP, max 10MB), das Bild wird via bestehender `uploadSourceImage` Server Action zu R2 hochgeladen, eine Thumbnail-Preview erscheint inline in der User-Message, und die R2-URL wird als `image_url` mit der naechsten Nachricht an das Backend gesendet.

---

## Acceptance Criteria

1) GIVEN der Chat-Input ist sichtbar
   WHEN der User auf den Image-Upload-Button (Image Icon) klickt
   THEN oeffnet sich ein nativer File-Picker mit Accept-Filter fuer `image/jpeg, image/png, image/webp`

2) GIVEN der File-Picker ist geoeffnet
   WHEN der User eine gueltige Bilddatei auswaehlt (z.B. JPEG, 2MB)
   THEN wird `uploadSourceImage` mit der Datei aufgerufen und eine Upload-Progress-Anzeige erscheint am Image-Upload-Button (z.B. Spinner oder Progress-Indicator)

3) GIVEN ein Bild-Upload laeuft
   WHEN der Upload erfolgreich abgeschlossen ist
   THEN wird die R2-URL im lokalen State gespeichert (`pendingImageUrl`) und ein Thumbnail-Preview (max 80x80px) erscheint oberhalb der Chat-Input Textarea

4) GIVEN ein Bild-Preview ist sichtbar oberhalb der Textarea
   WHEN der User das X-Icon am Thumbnail klickt
   THEN wird der `pendingImageUrl` State geleert und das Thumbnail entfernt

5) GIVEN ein `pendingImageUrl` existiert im State und der User hat Text eingegeben
   WHEN der User auf Send klickt oder Enter drueckt
   THEN wird `sendMessage(content, pendingImageUrl)` aufgerufen (image_url Feld im Request) und der `pendingImageUrl` State wird zurueckgesetzt

6) GIVEN eine User-Message wurde mit `image_url` gesendet
   WHEN die Message im Chat-Thread gerendert wird
   THEN erscheint ein Thumbnail (max 120x120px, abgerundete Ecken) des hochgeladenen Bildes inline in der User-Message-Bubble, oberhalb des Nachrichtentexts

7) GIVEN der User waehlt eine Datei groesser als 10MB
   WHEN die Datei-Validierung laeuft
   THEN wird ein Toast-Fehler angezeigt ("Bild darf maximal 10 MB gross sein") und kein Upload gestartet

8) GIVEN der User waehlt eine Datei mit ungueltigem Format (z.B. .gif, .bmp)
   WHEN die Datei-Validierung laeuft
   THEN wird ein Toast-Fehler angezeigt ("Nur JPEG, PNG und WebP Bilder werden unterstuetzt") und kein Upload gestartet

9) GIVEN ein Bild-Upload schlaegt fehl (Netzwerkfehler, R2-Fehler)
   WHEN der Fehler auftritt
   THEN wird ein Toast-Fehler angezeigt ("Bild konnte nicht hochgeladen werden") und der Upload-Progress wird zurueckgesetzt

10) GIVEN kein `pendingImageUrl` existiert und die Textarea ist leer
    WHEN der User auf Send klickt
    THEN passiert nichts (Send-Button bleibt disabled, konsistent mit Slice 09 AC-7)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbstaendig.
> **Syntax:** TypeScript/Vitest

### Test-Datei: `components/assistant/__tests__/image-upload-button.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('ImageUploadButton', () => {
  // AC-1: File-Picker oeffnet sich mit korrektem Accept-Filter
  it.todo('should open file picker accepting image/jpeg, image/png, image/webp on click')

  // AC-2: Upload wird mit Progress gestartet
  it.todo('should call uploadSourceImage and show progress indicator when file is selected')

  // AC-7: Datei groesser als 10MB wird abgelehnt
  it.todo('should show error toast and not upload when file exceeds 10MB')

  // AC-8: Ungueltiges Format wird abgelehnt
  it.todo('should show error toast and not upload for unsupported file formats')

  // AC-9: Upload-Fehler wird als Toast angezeigt
  it.todo('should show error toast and reset progress when upload fails')
})
```
</test_spec>

### Test-Datei: `components/assistant/__tests__/image-preview.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('ImagePreview', () => {
  // AC-3: Thumbnail-Preview erscheint nach Upload
  it.todo('should render thumbnail with image URL after successful upload')

  // AC-4: X-Button entfernt Preview
  it.todo('should call onRemove and hide thumbnail when X icon is clicked')

  // AC-6: Inline-Thumbnail in User-Message-Bubble
  it.todo('should render image thumbnail inside user message bubble when message has image_url')
})
```
</test_spec>

### Test-Datei: `components/assistant/__tests__/chat-input-image.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('ChatInput (Image Integration)', () => {
  // AC-5: sendMessage mit image_url aufgerufen und pendingImageUrl zurueckgesetzt
  it.todo('should call sendMessage with content and pendingImageUrl on submit and reset pendingImageUrl')

  // AC-10: Send disabled ohne Text und ohne Bild
  it.todo('should keep send button disabled when no text and no pendingImageUrl')

  // AC-3: Preview-Bereich oberhalb der Textarea sichtbar bei pendingImageUrl
  it.todo('should show image preview area above textarea when pendingImageUrl is set')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| slice-09-startscreen-chips | `ChatInput` Component | Component | Wird erweitert: Image-Upload-Integration, `onSend` Signatur um `imageUrl?` erweitern |
| slice-10-core-chat-loop | `PromptAssistantContext` | React Context | `sendMessage(content: string, imageUrl?: string)` muss `image_url` im Request-Body mitschicken |
| slice-10-core-chat-loop | `ChatThread` Component | Component | Muss Messages mit `image_url` Feld rendern koennen (Thumbnail in Bubble) |
| slice-16-analyze-image-tool | `analyze_image` Backend Tool | LangGraph Tool | Backend verarbeitet `image_url` aus `SendMessageRequest` und ruft analyze_image Tool auf |
| (existing) | `uploadSourceImage` Server Action | Server Action | `uploadSourceImage({projectId, file}) -> {url}` in `app/actions/generations.ts` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `ImageUploadButton` | Component | Kein direkter Consumer (in ChatInput integriert) | `<ImageUploadButton onUploadComplete={(url: string) => void} onError={(msg: string) => void} disabled={boolean}>` |
| `ImagePreview` | Component | Kein direkter Consumer (in ChatInput + ChatThread integriert) | `<ImagePreview src={string} onRemove?={() => void} size="sm" \| "md">` |
| `ChatInput` (erweitert) | Component | slice-10 Consumer nutzen erweiterte Version | `<ChatInput onSend={(text: string, imageUrl?: string) => void} ...>` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/assistant/image-upload-button.tsx` -- File-Picker Trigger, Datei-Validierung (Format + Groesse), uploadSourceImage Call, Progress-State
- [ ] `components/assistant/image-preview.tsx` -- Thumbnail-Anzeige (Pending-Preview oberhalb Textarea + Inline in User-Message), X-Button zum Entfernen
- [ ] `components/assistant/chat-input.tsx` (erweitert) -- pendingImageUrl State, ImagePreview + ImageUploadButton integrieren, sendMessage mit image_url
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Dieser Slice implementiert KEIN Bild-Caching in der DB (kommt in Slice 18 mit `assistant_images` Tabelle)
- Dieser Slice implementiert KEINE Drag-and-Drop Funktionalitaet (nur File-Picker via Button)
- Dieser Slice implementiert KEINE Bild-Vollansicht bei Klick auf Thumbnail (Optional, spaeter)
- Max 1 Bild pro Message (kein Multi-Upload)
- Der Image-Upload-Button ist nur im Chat-Input Footer integriert, nicht als eigene Sektion

**Technische Constraints:**
- Nutze `lucide-react` Icons: `Image` (Upload-Button), `X` (Preview entfernen), `Loader2` (Upload-Progress)
- File-Validierung client-seitig: `accept="image/jpeg,image/png,image/webp"` am Input + JS-Check fuer Groesse (10MB = 10 * 1024 * 1024 Bytes)
- `uploadSourceImage` aus `app/actions/generations.ts` wiederverwenden -- kein neuer Upload-Endpunkt
- Fehler-Toasts via `sonner` (bereits installiert)
- Thumbnail-Rendering via `<img>` mit `object-fit: cover` -- kein Next.js Image-Component noetig (externe R2 URLs)
- `pendingImageUrl` State lebt im ChatInput (lokaler useState), wird bei Send an Context/Hook weitergegeben

**Referenzen:**
- Architecture: `specs/phase-3/2026-03-11-prompt-assistant/architecture.md` -> Section "API Design / DTOs" (SendMessageRequest: `image_url?: string`)
- Architecture: `specs/phase-3/2026-03-11-prompt-assistant/architecture.md` -> Section "Validation Rules" (image_url: valid URL, R2 domain)
- Wireframes: `specs/phase-3/2026-03-11-prompt-assistant/wireframes.md` -> Section "Screen: Chatting with Image Upload" (Thumbnail in User-Message)
- Discovery: `specs/phase-3/2026-03-11-prompt-assistant/discovery.md` -> Section "Business Rules" (Bild-Upload: max 1 Bild/Message, JPEG/PNG/WebP, max 10MB)
- Discovery: `specs/phase-3/2026-03-11-prompt-assistant/discovery.md` -> Section "UI Components & States" (image-upload-btn, image-preview)
