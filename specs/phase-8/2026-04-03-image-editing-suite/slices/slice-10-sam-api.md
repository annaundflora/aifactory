# Slice 10: SAM API Route

> **Slice 10 von 16** fuer `AI Image Editing Suite`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-10-sam-api` |
| **Test** | `pnpm test app/api/sam/__tests__/segment-route.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-07-inpaint-integration"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test app/api/sam/__tests__/segment-route.test.ts` |
| **Integration Command** | -- |
| **Acceptance Command** | `pnpm test -- --run` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (Replicate API gemockt, R2 Upload gemockt, Auth gemockt) |

---

## Ziel

Neuen Next.js Route Handler `POST /api/sam/segment` erstellen. Der Endpoint nimmt Klick-Koordinaten und eine Bild-URL entgegen, validiert die Eingaben, ruft SAM 2 via Replicate auf, laedt die resultierende Mask-PNG zu R2 hoch (temporaer, 24h TTL) und gibt die `mask_url` zurueck.

---

## Acceptance Criteria

1) GIVEN ein authentifizierter User
   WHEN `POST /api/sam/segment` mit `{ image_url: "https://r2.example.com/image.png", click_x: 0.5, click_y: 0.3 }` aufgerufen wird
   THEN antwortet der Endpoint mit HTTP 200 und Body `{ mask_url: "<valid R2 URL>" }`

2) GIVEN ein nicht-authentifizierter Request
   WHEN `POST /api/sam/segment` aufgerufen wird
   THEN antwortet der Endpoint mit HTTP 401

3) GIVEN ein authentifizierter User
   WHEN `POST /api/sam/segment` mit `{ click_x: 1.5, click_y: 0.3, image_url: "https://r2.example.com/img.png" }` aufgerufen wird (click_x ausserhalb 0.0-1.0)
   THEN antwortet der Endpoint mit HTTP 400 und Body `{ error: "Koordinaten muessen normalisiert sein (0-1)" }`

4) GIVEN ein authentifizierter User
   WHEN `POST /api/sam/segment` mit `{ click_x: 0.5, click_y: 0.3 }` aufgerufen wird (image_url fehlt)
   THEN antwortet der Endpoint mit HTTP 400 und Body `{ error: "image_url ist erforderlich" }`

5) GIVEN ein authentifizierter User
   WHEN `POST /api/sam/segment` mit gueltigem Body aufgerufen wird
   THEN wird der Replicate Client mit Modell `meta/sam-2` und den uebergebenen Koordinaten + Bild-URL aufgerufen

6) GIVEN der Replicate-Aufruf liefert eine Mask-PNG zurueck
   WHEN die Response verarbeitet wird
   THEN wird die Mask-PNG via `StorageService.upload()` zu R2 hochgeladen mit Prefix `masks/` und temporaerem TTL
   AND die resultierende R2-URL wird als `mask_url` zurueckgegeben

7) GIVEN der Replicate-Aufruf schlaegt fehl (Timeout oder API-Error)
   WHEN die Response verarbeitet wird
   THEN antwortet der Endpoint mit HTTP 502 und Body `{ error: "SAM-Fehler. Versuche manuelles Maskieren." }`

8) GIVEN der Replicate-Aufruf liefert eine leere Mask (kein Objekt erkannt)
   WHEN die Response verarbeitet wird
   THEN antwortet der Endpoint mit HTTP 422 und Body `{ error: "Kein Objekt erkannt. Versuche einen anderen Punkt." }`

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `app/api/sam/__tests__/segment-route.test.ts`

<test_spec>
```typescript
// AC-1: Erfolgreicher SAM-Aufruf mit gueltigen Koordinaten gibt 200 + mask_url zurueck
it.todo('should return 200 with mask_url for valid SAM segment request')

// AC-2: Nicht-authentifizierter Request gibt 401 zurueck
it.todo('should return 401 when user is not authenticated')

// AC-3: click_x ausserhalb 0-1 Range gibt 400 zurueck
it.todo('should return 400 when click_x is outside 0-1 range')

// AC-4: Fehlende image_url gibt 400 zurueck
it.todo('should return 400 when image_url is missing')

// AC-5: Replicate wird mit meta/sam-2 und korrekten Parametern aufgerufen
it.todo('should call Replicate with meta/sam-2 model and provided coordinates')

// AC-6: Mask-PNG wird zu R2 mit masks/ Prefix hochgeladen
it.todo('should upload mask PNG to R2 with masks/ prefix and return R2 URL as mask_url')

// AC-7: Replicate-Fehler gibt 502 mit SAM-Fehlermeldung zurueck
it.todo('should return 502 with SAM error message when Replicate call fails')

// AC-8: Leere Mask gibt 422 mit "Kein Objekt erkannt" zurueck
it.todo('should return 422 when SAM returns empty mask')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-07` | `StorageService.upload()` mit `masks/` Prefix Pattern | Function | Import aus `lib/clients/storage.ts`, Mask-Upload funktioniert |
| -- | `requireAuth()` Session-Check | Function | Bestehende Auth-Utility |
| -- | Replicate Client mit Rate Limiting | Client | Import aus `lib/clients/replicate.ts` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `POST /api/sam/segment` | REST Endpoint | slice-11 (Click-to-Edit Frontend) | `(SAMSegmentRequest) => SAMSegmentResponse` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `app/api/sam/segment/route.ts` -- Next.js Route Handler: Auth-Check, Input-Validierung, Replicate SAM 2 Aufruf, R2 Mask-Upload, Response
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Frontend-Logik (Click-Handler, Mask-Overlay-Rendering) -- das ist Slice 11
- KEIN neuer Replicate-Client oder Storage-Client -- bestehende Clients importieren
- KEINE Mask-Nachbearbeitung (Feathering, Scaling) -- SAM liefert fertige Mask-PNG
- KEINE Persistierung der Mask in der DB -- nur temporaerer R2-Upload mit TTL

**Technische Constraints:**
- Route Handler Pattern konsistent mit `app/api/models/sync/route.ts` (bestehendes Muster)
- Replicate Modell-ID: `meta/sam-2` (siehe architecture.md → Integrations)
- Koordinaten-Validierung: `click_x` und `click_y` muessen Float im Range 0.0-1.0 sein
- `image_url` muss gegen erlaubte R2-Domain validiert werden (SSRF-Schutz, siehe architecture.md → Input Validation)
- Mask-Upload Prefix: `masks/` (konsistent mit Slice 07 Mask-Upload-Pattern)
- Timeout fuer Replicate-Aufruf: 30s (siehe architecture.md → Risks)
- Fehlermeldungen auf Deutsch (konsistent mit architecture.md → Error Handling Strategy)

**Reuse (PFLICHT):**

| Existing File | Usage in this Slice |
|---|---|
| `lib/clients/replicate.ts` | IMPORT -- bestehender Rate-Limited Replicate Client fuer SAM 2 Aufruf |
| `lib/clients/storage.ts` | IMPORT -- `StorageService.upload()` fuer Mask-PNG R2-Upload |
| `app/api/models/sync/route.ts` | REFERENCE -- Route Handler Pattern (Auth, Error Handling) als Vorlage |

**Referenzen:**
- Architecture: `architecture.md` → API Design, Zeile 80-92 (SAM Endpoint Definition, DTOs)
- Architecture: `architecture.md` → Server Logic, Zeile 149 (SAMService Responsibility)
- Architecture: `architecture.md` → Business Logic Flow, Zeile 190-199 (SAM Flow)
- Architecture: `architecture.md` → Validation Rules, Zeile 211 (click_x/click_y Range)
- Architecture: `architecture.md` → Security, Zeile 222 (Auth), Zeile 238-239 (SSRF-Schutz)
- Architecture: `architecture.md` → Error Handling Strategy, Zeile 312-313 (SAM-spezifische Fehler)
- Architecture: `architecture.md` → Integrations, Zeile 372 (SAM 2 Meta Replicate)
- Architecture: `architecture.md` → NFRs, Zeile 392 (SAM Latenz < 5s)
- Discovery: `discovery.md` → Flow 4: Click-to-Edit, Zeile 145-156 (SAM Auto-Mask Flow)
