# Slice 13: Dockerfile + Production Docker Compose

> **Slice 13 von 14** fuer `Security Hardening for Public Deployment`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-13-dockerfile-compose` |
| **Test** | `pnpm test __tests__/docker/dockerfile-compose` |
| **E2E** | `false` |
| **Dependencies** | `["slice-12-security-headers"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` + `docker` |
| **Test Command** | `pnpm test __tests__/docker/dockerfile-compose` |
| **Integration Command** | `docker compose -f docker-compose.prod.yml build` |
| **Acceptance Command** | `docker compose -f docker-compose.prod.yml up -d && sleep 10 && curl -sf http://localhost:3000 && docker compose -f docker-compose.prod.yml down` |
| **Start Command** | `docker compose -f docker-compose.prod.yml up -d` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `no_mocks` |

---

## Ziel

Multi-Stage Dockerfile fuer die Next.js App erstellen (basierend auf `node:22.14.0-slim` mit standalone Output) und eine Production-Variante von Docker Compose (`docker-compose.prod.yml`) bereitstellen, die App + DB in einem privaten Netzwerk betreibt -- ohne exponierten DB-Port und mit starken Credentials via `.env`.

---

## Acceptance Criteria

1) GIVEN ein `Dockerfile` im Repo-Root
   WHEN `docker compose -f docker-compose.prod.yml build` ausgefuehrt wird
   THEN ist der Build erfolgreich (Exit-Code 0) und das App-Image wird erstellt

2) GIVEN das gebaute App-Image
   WHEN `docker images` die Image-Groesse anzeigt
   THEN ist die Image-Groesse < 500MB

3) GIVEN das `Dockerfile`
   WHEN der Build-Prozess analysiert wird
   THEN nutzt es mindestens 3 Stages (deps, build, runner) mit `node:22.14.0-slim` als Base-Image

4) GIVEN das `Dockerfile` Runner-Stage
   WHEN der Container gestartet wird
   THEN laeuft der Prozess als Non-Root User (nicht `root`)

5) GIVEN die `docker-compose.prod.yml`
   WHEN `docker compose -f docker-compose.prod.yml up -d` ausgefuehrt wird
   THEN starten sowohl der App-Service als auch der DB-Service (postgres) erfolgreich

6) GIVEN die `docker-compose.prod.yml`
   WHEN die Service-Konfiguration analysiert wird
   THEN ist der DB-Service Port (5432) NICHT nach aussen exponiert (kein `ports`-Mapping auf dem DB-Service)

7) GIVEN die `docker-compose.prod.yml`
   WHEN die Netzwerk-Konfiguration analysiert wird
   THEN kommunizieren App und DB ueber ein dediziertes privates Docker-Netzwerk

8) GIVEN die `docker-compose.prod.yml`
   WHEN die DB-Credentials geprueft werden
   THEN werden `POSTGRES_USER`, `POSTGRES_PASSWORD` und `POSTGRES_DB` aus `.env`-Variablen gelesen (keine Hardcoded-Defaults wie `aifactory_dev`)

9) GIVEN `docker compose -f docker-compose.prod.yml up -d` laeuft
   WHEN ein HTTP-Request an `http://localhost:3000` gesendet wird
   THEN antwortet die App mit HTTP 200 (oder Redirect zu `/login`)

10) GIVEN `next.config.ts`
    WHEN die Config-Option `output` geprueft wird
    THEN ist `output: "standalone"` gesetzt

11) GIVEN `next.config.ts` mit `output: "standalone"`
    WHEN `pnpm build` ausgefuehrt wird
    THEN ist der Build erfolgreich und die bestehenden Config-Optionen (`rewrites`, `images`, `experimental`, `headers`) funktionieren weiterhin

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `__tests__/docker/dockerfile-compose.test.ts`

<test_spec>
```typescript
// Tests fuer Dockerfile und docker-compose.prod.yml
// Strategie: Dateien als Text lesen und Struktur/Konfiguration validieren

// AC-1: Build-Faehigkeit (Integration Command prueft live)
it.todo('should have a valid Dockerfile in repo root')

// AC-2: Image-Groesse (Acceptance Command prueft live)
// Kein Unit-Test moeglich — wird via docker images geprueft

// AC-3: Multi-Stage Build mit node:22.14.0-slim
it.todo('should use at least 3 FROM stages in Dockerfile with node:22.14.0-slim base')

// AC-4: Non-Root User im Runner-Stage
it.todo('should configure a non-root USER in Dockerfile runner stage')

// AC-5: App + DB Services definiert
it.todo('should define app and postgres services in docker-compose.prod.yml')

// AC-6: DB-Port nicht exponiert
it.todo('should not expose postgres port in docker-compose.prod.yml')

// AC-7: Privates Docker-Netzwerk
it.todo('should define a dedicated private network in docker-compose.prod.yml')

// AC-8: Credentials aus .env (keine Hardcoded-Defaults)
it.todo('should reference environment variables for DB credentials without hardcoded defaults')

// AC-9: App erreichbar (Acceptance Command prueft live)
// Kein Unit-Test moeglich — wird via curl geprueft

// AC-10: next.config.ts output standalone
it.todo('should set output standalone in next.config.ts')

// AC-11: Build-Kompatibilitaet mit bestehender Config
it.todo('should preserve existing rewrites, images, experimental, and headers config in next.config.ts')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| slice-12-security-headers | `next.config.ts` mit `headers()` | Config-Funktion | `headers()` existiert und gibt Header-Array zurueck |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `Dockerfile` | Docker Build | slice-14-caddy | Multi-Stage Build fuer Next.js standalone App |
| `docker-compose.prod.yml` | Compose Config | slice-14-caddy | Services `app` + `db` im Netzwerk `internal` |
| `next.config.ts` mit `output: "standalone"` | Config | slice-14-caddy | Standalone Output fuer Docker-Deployment |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `Dockerfile` -- Multi-Stage Build (deps, build, runner) mit node:22.14.0-slim, Non-Root User, standalone Output
- [ ] `docker-compose.prod.yml` -- Production Compose mit App + DB Services, privates Netzwerk, Credentials via .env
- [ ] `next.config.ts` -- AENDERUNG: `output: "standalone"` hinzufuegen
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEIN Caddy-Service (das macht Slice 14)
- KEIN `.env.example` (das macht Slice 14)
- KEINE `.dockerignore` Datei (optional, aber nicht im Scope definiert)
- KEIN SSL/TLS Setup (Caddy in Slice 14)
- KEINE Aenderungen an `docker-compose.yml` (bleibt als Dev-Variante)

**Technische Constraints:**
- Base-Image: exakt `node:22.14.0-slim` (gepinnte Version, siehe architecture.md Integrations)
- DB-Image: `postgres:16` (konsistent mit bestehendem `docker-compose.yml`)
- Standalone Output erfordert `output: "standalone"` in `next.config.ts`
- Runner-Stage muss als Non-Root User laufen (Security Best Practice)
- DB-Service darf KEINEN `ports`-Eintrag haben (nur internes Netzwerk)
- App-Service exponiert Port 3000 (Caddy proxied in Slice 14 darauf)
- Bestehende `next.config.ts` Optionen (`rewrites`, `images`, `experimental`, `headers` aus Slice 12) duerfen NICHT veraendert werden

**Referenzen:**
- Architecture: `specs/phase-6/2026-03-15-security-hardening/architecture.md` -- Section "Constraints & Integrations" (Docker Base node:22.14.0-slim, postgres:16)
- Architecture: `specs/phase-6/2026-03-15-security-hardening/architecture.md` -- Section "Quality Attributes" (Image-Groesse < 500MB)
- Architecture: `specs/phase-6/2026-03-15-security-hardening/architecture.md` -- Section "Technology Decisions" (Multi-Stage Build, standalone output)
- Discovery: `specs/phase-6/2026-03-15-security-hardening/discovery.md` -- Section "Security Report Findings" (DB-Port exposed, Default-Credentials)
- Bestehend: `docker-compose.yml` -- Dev-Variante als Referenz fuer DB-Konfiguration
