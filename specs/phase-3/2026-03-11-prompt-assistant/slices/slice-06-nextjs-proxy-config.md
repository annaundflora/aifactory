# Slice 06: Next.js Proxy Rewrite + Config

> **Slice 6 von 22** fuer `Prompt Assistant`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-06-nextjs-proxy-config` |
| **Test** | `pnpm test next.config` |
| **E2E** | `false` |
| **Dependencies** | `[]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

> **Quelle:** Auto-detected vom Slice-Writer Agent basierend auf Repo-Indikatoren.

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` (Next.js 16.1.6, React 19.2.3, pnpm) |
| **Test Command** | `pnpm test next.config` |
| **Integration Command** | `pnpm build` |
| **Acceptance Command** | `pnpm dev` (manuell: Request an `/api/assistant/health` pruefen) |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000/api/assistant/health` (proxied zu FastAPI) |
| **Mocking Strategy** | `no_mocks` |

---

## Ziel

Next.js Rewrites konfigurieren, damit alle Requests unter `/api/assistant/*` transparent an das Python FastAPI Backend weitergeleitet werden. Die Backend-URL ist ueber eine Environment-Variable konfigurierbar fuer verschiedene Umgebungen (Entwicklung, Staging, Produktion).

---

## Acceptance Criteria

1) GIVEN die aktuelle `next.config.ts` ohne rewrites
   WHEN der Implementer die rewrites-Konfiguration hinzufuegt
   THEN enthaelt `next.config.ts` eine `rewrites` Funktion die ein Array mit mindestens einem Eintrag zurueckgibt: `source: "/api/assistant/:path*"` -> `destination: "${ASSISTANT_BACKEND_URL}/api/assistant/:path*"`

2) GIVEN `ASSISTANT_BACKEND_URL` ist NICHT gesetzt (kein `.env`)
   WHEN Next.js die rewrites-Konfiguration laedt
   THEN wird der Default-Wert `http://localhost:8000` verwendet, sodass `/api/assistant/:path*` auf `http://localhost:8000/api/assistant/:path*` zeigt

3) GIVEN `ASSISTANT_BACKEND_URL=http://backend.example.com:9000` in `.env.local`
   WHEN Next.js die rewrites-Konfiguration laedt
   THEN wird die custom URL verwendet: `/api/assistant/:path*` zeigt auf `http://backend.example.com:9000/api/assistant/:path*`

4) GIVEN die erweiterte `next.config.ts`
   WHEN `pnpm build` ausgefuehrt wird
   THEN laeuft der Build erfolgreich durch (Exit-Code 0) ohne Warnungen bezueglich der rewrites-Konfiguration

5) GIVEN die erweiterte `next.config.ts`
   WHEN `pnpm dev` ausgefuehrt wird und ein GET-Request an `http://localhost:3000/api/assistant/health` gesendet wird (FastAPI Backend laeuft auf Port 8000)
   THEN wird der Request an `http://localhost:8000/api/assistant/health` durchgeleitet und die FastAPI-Antwort `{"status": "ok", "version": "1.0.0"}` zurueckgegeben

6) GIVEN die erweiterte `next.config.ts`
   WHEN die bestehende `images.remotePatterns` Konfiguration inspiziert wird
   THEN ist sie unveraendert vorhanden (R2-Hostname Pattern bleibt bestehen)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbstaendig.
> **Syntax:** TypeScript/Vitest

### Test-Datei: `__tests__/next-config.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('next.config.ts rewrites', () => {
  // AC-1: rewrites-Konfiguration vorhanden
  it.todo('should define rewrites with /api/assistant/:path* source')

  // AC-2: Default Backend-URL wenn env nicht gesetzt
  it.todo('should use http://localhost:8000 as default backend URL')

  // AC-3: Custom Backend-URL aus Environment-Variable
  it.todo('should use ASSISTANT_BACKEND_URL when set')

  // AC-6: Bestehende images config unveraendert
  it.todo('should preserve existing images.remotePatterns configuration')
})
```
</test_spec>

> **Hinweis:** AC-4 (Build) und AC-5 (Proxy-Durchleitung) sind Integrations-/Acceptance-Tests und werden manuell oder via CI validiert, nicht als Unit-Tests.

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| (keine) | -- | -- | -- |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| Proxy-Route `/api/assistant/:path*` | Next.js Rewrite | slice-10 (Core Chat Loop), slice-13b (Session-Liste UI) | Alle Frontend-Requests an `/api/assistant/*` werden transparent an FastAPI Backend proxied |
| `ASSISTANT_BACKEND_URL` | Environment-Variable | Deployment/CI | Default: `http://localhost:8000`, konfigurierbar via `.env.local` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `next.config.ts` -- Erweitert um `rewrites` Funktion mit `/api/assistant/:path*` Proxy-Regel und `ASSISTANT_BACKEND_URL` env var
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Dieser Slice erstellt KEINE FastAPI Endpoints (kommt in Slice 02)
- Dieser Slice erstellt KEINE `.env.local` Datei (nur Dokumentation der Variable)
- Dieser Slice aendert KEINE bestehenden API-Routes unter `/api/`
- Kein CORS-Setup noetig (Same-Origin durch Proxy-Pattern)

**Technische Constraints:**
- Next.js 16.1.6 `rewrites` API nutzen (async function in config)
- `ASSISTANT_BACKEND_URL` via `process.env` lesen (Next.js config hat Zugriff auf Node.js env)
- Bestehende Config-Properties (`images.remotePatterns`) muessen erhalten bleiben
- Trailing Slashes beachten: kein doppelter Slash in der destination URL

**Referenzen:**
- Architecture: `specs/phase-3/2026-03-11-prompt-assistant/architecture.md` -> Section "Architecture Layers" (Next.js Rewrites Proxy)
- Architecture: `specs/phase-3/2026-03-11-prompt-assistant/architecture.md` -> Section "API Design" (Base Path `/api/assistant`)
- Architecture: `specs/phase-3/2026-03-11-prompt-assistant/architecture.md` -> Section "Security" (Same-origin, kein CORS noetig)
- slim-slices: `specs/phase-3/2026-03-11-prompt-assistant/slim-slices.md` -> Slice 06
