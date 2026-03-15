# Slice 10: Server Action Auth - Upload + SSRF Fix

> **Slice 10 von 14** fuer `Security Hardening for Public Deployment`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-10-auth-upload-ssrf` |
| **Test** | `pnpm vitest run __tests__/slice-10` |
| **E2E** | `false` |
| **Dependencies** | `["slice-06-auth-guard"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm vitest run __tests__/slice-10` |
| **Integration Command** | `pnpm run build` |
| **Acceptance Command** | `pnpm vitest run __tests__/slice-10` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` |

---

## Ziel

Die Upload Server Action (`uploadSourceImage`) mit `requireAuth()` absichern und einen URL-Validator (`lib/security/url-validator.ts`) erstellen, der SSRF-Angriffe verhindert. Der Validator prueft auf HTTPS-only und blockiert Private-IP-Ranges, Localhost und unsichere Protokolle, bevor ein server-seitiger `fetch()` ausgefuehrt wird.

---

## Acceptance Criteria

1) GIVEN kein User ist eingeloggt (keine gueltige Session)
   WHEN `uploadSourceImage({ projectId: "abc", url: "https://example.com/img.png" })` aufgerufen wird
   THEN gibt die Action `{ error: "Unauthorized" }` zurueck, OHNE einen fetch() auszufuehren

2) GIVEN kein User ist eingeloggt (keine gueltige Session)
   WHEN `uploadSourceImage({ projectId: "abc", file: validFile })` aufgerufen wird
   THEN gibt die Action `{ error: "Unauthorized" }` zurueck, OHNE einen Upload auszufuehren

3) GIVEN ein User ist eingeloggt
   WHEN `uploadSourceImage` mit URL `http://evil.com/image.png` aufgerufen wird (HTTP statt HTTPS)
   THEN gibt die Action `{ error: "Only HTTPS URLs allowed" }` zurueck

4) GIVEN ein User ist eingeloggt
   WHEN `uploadSourceImage` mit URL `file:///etc/passwd` aufgerufen wird
   THEN gibt die Action `{ error: "Only HTTPS URLs allowed" }` zurueck

5) GIVEN ein User ist eingeloggt
   WHEN `uploadSourceImage` mit URL `https://169.254.169.254/latest/meta-data/` aufgerufen wird
   THEN gibt die Action `{ error: "URL points to private network" }` zurueck

6) GIVEN ein User ist eingeloggt
   WHEN `uploadSourceImage` mit URL `https://127.0.0.1/img.png` aufgerufen wird
   THEN gibt die Action `{ error: "URL points to private network" }` zurueck

7) GIVEN ein User ist eingeloggt
   WHEN `uploadSourceImage` mit URL `https://10.0.0.1/img.png` aufgerufen wird
   THEN gibt die Action `{ error: "URL points to private network" }` zurueck

8) GIVEN ein User ist eingeloggt
   WHEN `uploadSourceImage` mit URL `https://172.16.0.1/img.png` aufgerufen wird
   THEN gibt die Action `{ error: "URL points to private network" }` zurueck

9) GIVEN ein User ist eingeloggt
   WHEN `uploadSourceImage` mit URL `https://192.168.1.1/img.png` aufgerufen wird
   THEN gibt die Action `{ error: "URL points to private network" }` zurueck

10) GIVEN ein User ist eingeloggt
    WHEN `uploadSourceImage` mit URL `https://localhost/img.png` aufgerufen wird
    THEN gibt die Action `{ error: "URL points to private network" }` zurueck

11) GIVEN ein User ist eingeloggt
    WHEN `uploadSourceImage` mit URL `https://[::1]/img.png` aufgerufen wird
    THEN gibt die Action `{ error: "URL points to private network" }` zurueck

12) GIVEN ein User ist eingeloggt
    WHEN `uploadSourceImage` mit URL `https://valid-host.com/img.png` aufgerufen wird (gueltige oeffentliche URL)
    THEN wird der fetch() ausgefuehrt und die bestehende Upload-Logik verarbeitet das Bild

13) GIVEN `validateUrl()` wird mit einem unparsbaren String aufgerufen (z.B. `"not-a-url"`)
    WHEN die URL geparsed wird
    THEN gibt `validateUrl` `{ valid: false, reason: "Invalid URL" }` zurueck

14) GIVEN ein User ist eingeloggt
    WHEN `uploadSourceImage` mit URL `https://0.0.0.0/img.png` aufgerufen wird
    THEN gibt die Action `{ error: "URL points to private network" }` zurueck

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `__tests__/slice-10/url-validator.test.ts`

<test_spec>
```typescript
// AC-3: HTTP URL rejected
it.todo('should reject http:// URLs with "Only HTTPS URLs allowed"')

// AC-4: file:// URL rejected
it.todo('should reject file:// URLs with "Only HTTPS URLs allowed"')

// AC-13: Unparsable URL
it.todo('should reject unparsable strings with "Invalid URL"')

// AC-5: Link-local IP (169.254.x)
it.todo('should reject https://169.254.169.254 with "URL points to private network"')

// AC-6: Loopback IP (127.x)
it.todo('should reject https://127.0.0.1 with "URL points to private network"')

// AC-7: Private IP (10.x)
it.todo('should reject https://10.0.0.1 with "URL points to private network"')

// AC-8: Private IP (172.16.x)
it.todo('should reject https://172.16.0.1 with "URL points to private network"')

// AC-9: Private IP (192.168.x)
it.todo('should reject https://192.168.1.1 with "URL points to private network"')

// AC-10: Localhost hostname
it.todo('should reject https://localhost with "URL points to private network"')

// AC-11: IPv6 loopback
it.todo('should reject https://[::1] with "URL points to private network"')

// AC-14: 0.0.0.0
it.todo('should reject https://0.0.0.0 with "URL points to private network"')

// AC-12: Valid public URL
it.todo('should accept https://valid-host.com/img.png as valid')
```
</test_spec>

### Test-Datei: `__tests__/slice-10/upload-auth.test.ts`

<test_spec>
```typescript
// AC-1: Upload via URL ohne Session
it.todo('should return { error: "Unauthorized" } for URL upload without session')

// AC-2: Upload via File ohne Session
it.todo('should return { error: "Unauthorized" } for file upload without session')

// AC-3: Upload mit HTTP URL und gueltiger Session
it.todo('should return SSRF error for http:// URL with valid session')

// AC-12: Upload mit gueltiger HTTPS URL und gueltiger Session
it.todo('should proceed with fetch for valid HTTPS URL with valid session')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-06-auth-guard` | `requireAuth()` | Function | `() => Promise<{ userId: string; email: string } \| { error: string }>` aus `lib/auth/guard.ts` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `validateUrl()` | Function | (keiner -- intern fuer upload.ts) | `(url: string) => { valid: true } \| { valid: false; reason: string }` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/security/url-validator.ts` -- NEU: validateUrl() mit HTTPS-only Check und Private-IP-Range Blocklist
- [ ] `app/actions/upload.ts` -- AENDERUNG: requireAuth() am Anfang, validateUrl() vor fetch()
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEIN Ownership-Check auf projectId (das ist ein anderer Slice)
- KEINE DNS-Resolution/Lookup zur Laufzeit (reines Hostname/IP-Pattern-Matching genuegt)
- KEINE Aenderungen an anderen Server Actions ausser upload.ts
- KEINE Aenderungen am DB-Schema

**Technische Constraints:**
- `validateUrl()` ist eine pure synchrone Funktion (kein async, kein I/O)
- `requireAuth()` Import aus `lib/auth/guard.ts` (Slice 06 Deliverable)
- URL-Validierung nur im URL-Pfad von `uploadSourceImage` (nicht beim File-Upload)
- Bestehende Upload-Logik (MIME-Check, Size-Check, StorageService) bleibt unveraendert
- Error-Messages exakt wie in architecture.md definiert: `"Only HTTPS URLs allowed"`, `"URL points to private network"`, `"Invalid URL"`
- Blockierte IP-Ranges: `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `0.0.0.0`, `localhost`, `[::1]`

**Referenzen:**
- Architecture: `specs/phase-6/2026-03-15-security-hardening/architecture.md` --> Section "URL Validation Rules"
- Architecture: `specs/phase-6/2026-03-15-security-hardening/architecture.md` --> Section "SSRF Prevention"
- Architecture: `specs/phase-6/2026-03-15-security-hardening/architecture.md` --> Section "Server Logic" (URL Validator Service)
- Bestehender Code: `app/actions/upload.ts` --> fetch() in Zeile 37 ist die SSRF-Luecke
