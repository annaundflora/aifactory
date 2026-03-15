# Slice 12: Security Headers in Next.js Config

> **Slice 12 von 14** fuer `Security Hardening for Public Deployment`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-12-security-headers` |
| **Test** | `pnpm test __tests__/config/security-headers` |
| **E2E** | `false` |
| **Dependencies** | `[]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test __tests__/config/security-headers` |
| **Integration Command** | `pnpm build` |
| **Acceptance Command** | `curl -sI http://localhost:3000 \| grep -iE "(content-security-policy\|x-frame-options\|x-content-type-options\|referrer-policy\|strict-transport-security)"` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `no_mocks` |

---

## Ziel

Die Next.js-Konfiguration um eine `headers()` Funktion erweitern, die alle relevanten Security Headers auf jede Response setzt. Das schliesst Clickjacking (X-Frame-Options), MIME-Sniffing (X-Content-Type-Options), Referrer-Leakage (Referrer-Policy), Transport-Verschluesselung (HSTS) und Content-Injection (CSP) ab.

---

## Acceptance Criteria

1) GIVEN die App laeuft (dev oder production)
   WHEN ein beliebiger HTTP-Request an `http://localhost:3000` gesendet wird
   THEN enthaelt die Response den Header `X-Frame-Options: DENY`

2) GIVEN die App laeuft
   WHEN ein beliebiger HTTP-Request an `http://localhost:3000` gesendet wird
   THEN enthaelt die Response den Header `X-Content-Type-Options: nosniff`

3) GIVEN die App laeuft
   WHEN ein beliebiger HTTP-Request an `http://localhost:3000` gesendet wird
   THEN enthaelt die Response den Header `Referrer-Policy: strict-origin-when-cross-origin`

4) GIVEN die App laeuft
   WHEN ein beliebiger HTTP-Request an `http://localhost:3000` gesendet wird
   THEN enthaelt die Response den Header `Strict-Transport-Security: max-age=31536000; includeSubDomains`

5) GIVEN die App laeuft
   WHEN ein beliebiger HTTP-Request an `http://localhost:3000` gesendet wird
   THEN enthaelt die Response einen `Content-Security-Policy` Header der mindestens `default-src`, `script-src`, `style-src` und `img-src` Direktiven definiert

6) GIVEN die headers()-Funktion ist in next.config.ts definiert
   WHEN `pnpm build` ausgefuehrt wird
   THEN ist der Build erfolgreich (Exit-Code 0)

7) GIVEN die headers()-Funktion ist in next.config.ts definiert
   WHEN die bestehende rewrites()-Funktion aufgerufen wird
   THEN funktioniert das API-Rewriting zu `/api/assistant/:path*` weiterhin korrekt (keine Regression)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `__tests__/config/security-headers.test.ts`

<test_spec>
```typescript
// Tests fuer Security Headers in next.config.ts
// Strategie: next.config.ts importieren und headers()-Rueckgabe pruefen

// AC-1: X-Frame-Options Header
it.todo('should include X-Frame-Options DENY header for all routes')

// AC-2: X-Content-Type-Options Header
it.todo('should include X-Content-Type-Options nosniff header for all routes')

// AC-3: Referrer-Policy Header
it.todo('should include Referrer-Policy strict-origin-when-cross-origin header for all routes')

// AC-4: Strict-Transport-Security Header
it.todo('should include Strict-Transport-Security header with max-age=31536000 and includeSubDomains')

// AC-5: Content-Security-Policy Header
it.todo('should include Content-Security-Policy header with default-src, script-src, style-src, img-src directives')

// AC-6: Build-Kompatibilitaet
it.todo('should export a valid Next.js config object with headers function')

// AC-7: Keine Regression auf bestehende Config
it.todo('should preserve existing rewrites, images, and experimental config')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| -- | -- | -- | Keine Dependencies — Slice ist unabhaengig |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| Security Headers Config | Next.js headers() | slice-13 (Dockerfile + Production Compose) | `headers(): Promise<Header[]>` in next.config.ts |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `next.config.ts` -- Bestehende Config um async headers() Funktion erweitern mit 5 Security Headers
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEIN `output: "standalone"` hinzufuegen (das macht Slice 13)
- KEINE CSP-Nonces oder dynamische CSP-Generierung (statische Policy reicht)
- KEINE Aenderung an bestehenden `rewrites()`, `images` oder `experimental` Config-Werten

**Technische Constraints:**
- Die `headers()` Funktion muss den `source: "/(.*)"` Pattern nutzen um alle Routen abzudecken
- CSP muss kompatibel sein mit dem bestehenden Stack: Next.js Inline-Scripts, Tailwind CSS, externe Images (R2 CDN `pub-cd07f08bbf5d4226b8f7ef9510aef4bd.r2.dev`), Replicate API
- CSP darf die bestehende App-Funktionalitaet NICHT brechen (insbesondere `unsafe-inline` fuer Styles wegen Tailwind, `unsafe-eval` vermeiden wenn moeglich)

**Referenzen:**
- Architecture: `specs/phase-6/2026-03-15-security-hardening/architecture.md` -- Section "Migration Map", Zeile `next.config.ts`
- Discovery: `specs/phase-6/2026-03-15-security-hardening/discovery.md` -- Section "Security Report Findings" (Severity MEDIUM fuer fehlende Headers)
- Bestehende Config: `next.config.ts` -- aktuelle Struktur mit rewrites(), images, experimental
