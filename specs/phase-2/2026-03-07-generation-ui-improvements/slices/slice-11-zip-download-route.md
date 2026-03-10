# Slice 11: ZIP Download API Route

> **Slice 11** für `Generation UI Improvements`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-11-zip-download-route` |
| **Test** | `pnpm test app/api/download-zip/route.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `[]` |

---

## Test-Strategy (für Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test {path}` |
| **Integration Command** | `pnpm test {path} --reporter=verbose` |
| **Acceptance Command** | `pnpm test {path}` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` — DB via vi.mock, R2-Fetches via vi.mock(fetch) |

---

## Ziel

Eine neue Next.js Route Handler `GET /api/download-zip` erstellt auf Basis einer Liste von Generation-IDs einen ZIP-Archiv-Stream. Die Route validiert die IDs, lädt Bilddaten sequenziell von R2 und gibt das fertige ZIP direkt als `application/zip` Stream zurück. `jszip` wird als neue Dependency hinzugefügt.

---

## Acceptance Criteria

1. **Erfolgreicher ZIP-Download**
   GIVEN ein GET-Request an `/api/download-zip?ids=uuid1,uuid2`
   WHEN beide UUIDs gültig sind und Generierungen in der DB existieren
   THEN antwortet die Route mit HTTP 200, `Content-Type: application/zip`, `Content-Disposition: attachment; filename="generations-{timestamp}.zip"`, und der Response-Body ist ein gültiges ZIP-Archiv

2. **Dateinamen im ZIP entsprechen Generation-IDs**
   GIVEN ein ZIP-Archiv wird generiert für IDs `[uuid1, uuid2]`
   WHEN das ZIP heruntergeladen wird
   THEN enthält das ZIP genau die Dateien `{uuid1}.png` und `{uuid2}.png`

3. **Mehr als 50 IDs — 400 Bad Request**
   GIVEN ein GET-Request an `/api/download-zip?ids=uuid1,...,uuid51` mit 51 UUIDs
   WHEN die Route den Query-Parameter verarbeitet
   THEN antwortet die Route mit HTTP 400 und `{ error: "Zu viele Bilder ausgewählt" }`

4. **Leeres ids-Parameter — 400 Bad Request**
   GIVEN ein GET-Request an `/api/download-zip` ohne `ids`-Parameter (oder `ids=""`)
   WHEN die Route den Query-Parameter verarbeitet
   THEN antwortet die Route mit HTTP 400 und `{ error: string }`

5. **Ungültige UUID in ids — 400 Bad Request**
   GIVEN ein GET-Request mit `ids=valid-uuid,not-a-uuid`
   WHEN die Route die IDs validiert
   THEN antwortet die Route mit HTTP 400 und `{ error: string }`, ohne DB-Abfragen auszuführen

6. **R2-Fehler bei einem Bild — non-blocking**
   GIVEN ein GET-Request mit 3 gültigen IDs, wobei das R2-Fetch für eine ID fehlschlägt (HTTP 404 oder Netzwerkfehler)
   WHEN die Route die Bilder sequenziell von R2 holt
   THEN wird das fehlerhafte Bild im ZIP übersprungen, der Fehler per `console.error` geloggt, die Route antwortet trotzdem mit HTTP 200 und einem ZIP mit den verbleibenden Bildern

7. **DB-Fehler — 500 Internal Server Error**
   GIVEN die DB-Abfrage für die Generation-IDs wirft einen Fehler
   WHEN die Route versucht die Generierungen aus der DB zu laden
   THEN antwortet die Route mit HTTP 500 und `{ error: "Download fehlgeschlagen" }` und loggt den Fehler per `console.error`

---

## Test Skeletons

> **Für den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbstständig.

### Test-Datei: `app/api/download-zip/__tests__/route.test.ts`

<test_spec>
```typescript
// AC-1: Erfolgreicher ZIP-Download — HTTP 200 + Content-Type
it.todo('should return 200 with Content-Type application/zip')

// AC-1: Erfolgreicher ZIP-Download — Content-Disposition Header
it.todo('should set Content-Disposition attachment with generations-{timestamp}.zip filename')

// AC-2: Dateinamen im ZIP entsprechen Generation-IDs
it.todo('should create zip entries named {generation-id}.png for each id')

// AC-3: Mehr als 50 IDs — 400
it.todo('should return 400 when more than 50 ids are provided')

// AC-4: Leerer ids-Parameter — 400
it.todo('should return 400 when ids parameter is missing or empty')

// AC-5: Ungültige UUID — 400 ohne DB-Aufruf
it.todo('should return 400 for invalid UUID format without querying DB')

// AC-6: R2-Fehler bei einem Bild — ZIP trotzdem erstellen
it.todo('should skip failed R2 fetch and return zip with remaining images')

// AC-7: DB-Fehler — 500
it.todo('should return 500 and log error when DB query throws')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| — | `lib/db/queries.ts` (bestehend) | Query-Funktion | `getGenerationsByIds(ids: string[])` muss `imageUrl` pro Eintrag zurückgeben |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `GET /api/download-zip` | Route Handler | Floating Action Bar (UI) | `?ids=uuid1,uuid2,...` → `application/zip` oder `{ error: string }` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `app/api/download-zip/route.ts` — GET Route Handler: ID-Validierung (max 50, UUID-Format), DB-Lookup via Drizzle, sequenzielles R2-Fetch per `imageUrl`, ZIP-Erstellung mit jszip, Response als `application/zip` Stream
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehören NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Keine UI-Komponenten — der Download-Trigger liegt in der Floating Action Bar (anderer Slice)
- Keine Authentifizierung (Single-User-App, architecture.md → Security)
- Kein Streaming der ZIP-Daten chunk-by-chunk — ZIP wird in-memory vollständig gebaut, dann gestreamt
- Kein R2-Delete in dieser Route

**Technische Constraints:**
- `jszip` als neue Dependency hinzufügen (architecture.md → Integrations: jszip 3.10.1)
- UUID-Validierung per Regex vor jeder DB-Operation
- Bilder werden **sequenziell** von R2 gefetcht (kein `Promise.all`) um Memory-Druck bei großen Bildern zu vermeiden
- Dateinamen im ZIP: `{generation-id}.png` (architecture.md → API Routes)
- ZIP-Dateiname im Download: `generations-{timestamp}.zip`
- R2-Fetch-Fehler sind non-blocking: Fehler loggen (`console.error`), Bild überspringen, weitermachen
- Response-Header: `Content-Type: application/zip`, `Content-Disposition: attachment; filename="generations-{timestamp}.zip"`
- Limit: max 50 IDs — bei Überschreitung HTTP 400 (architecture.md → Validation Rules, Security)

**Referenzen:**
- Architecture: `specs/phase-2/2026-03-07-generation-ui-improvements/architecture.md` → API Routes, Validation Rules, Error Handling Strategy
- Architecture: `specs/phase-2/2026-03-07-generation-ui-improvements/architecture.md` → Quality Attributes (ZIP download: max 50, sequential fetches)
