# Slice 14: Caddy Reverse Proxy + .env.example

> **Slice 14 von 14** fuer `Security Hardening for Public Deployment`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-14-caddy-env` |
| **Test** | `pnpm test __tests__/docker/caddy-env` |
| **E2E** | `false` |
| **Dependencies** | `["slice-13-dockerfile-compose"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` + `docker` + `caddy` |
| **Test Command** | `pnpm test __tests__/docker/caddy-env` |
| **Integration Command** | `docker compose -f docker-compose.prod.yml config --quiet` |
| **Acceptance Command** | `docker compose -f docker-compose.prod.yml up -d && sleep 15 && curl -sf http://localhost:80 && docker compose -f docker-compose.prod.yml down` |
| **Start Command** | `docker compose -f docker-compose.prod.yml up -d` |
| **Health Endpoint** | `http://localhost:80` |
| **Mocking Strategy** | `no_mocks` |

---

## Ziel

Caddy als Reverse Proxy vor die Next.js App schalten (automatisches SSL via Let's Encrypt in Production, HTTP-Proxy in Dev/Test) und eine `.env.example` bereitstellen, die alle fuer das Production-Deployment benoetigten Environment-Variablen dokumentiert.

---

## Acceptance Criteria

1) GIVEN ein `Caddyfile` im Repo-Root
   WHEN die Caddy-Konfiguration analysiert wird
   THEN verwendet es die `{$DOMAIN}` Environment-Variable als Site-Adresse

2) GIVEN das `Caddyfile`
   WHEN die Reverse-Proxy-Konfiguration analysiert wird
   THEN leitet es alle Requests an den App-Service auf Port 3000 weiter (z.B. `app:3000`)

3) GIVEN die `docker-compose.prod.yml` aus Slice 13
   WHEN der Caddy-Service ergaenzt wird
   THEN existiert ein `caddy` Service mit Image `caddy:2.11.2-alpine`

4) GIVEN der `caddy` Service in `docker-compose.prod.yml`
   WHEN die Port-Konfiguration analysiert wird
   THEN exponiert er Port 80 und Port 443 nach aussen

5) GIVEN der `caddy` Service in `docker-compose.prod.yml`
   WHEN die Volume-Konfiguration analysiert wird
   THEN mountet er das `Caddyfile` als Config und hat persistente Volumes fuer `caddy_data` (SSL-Zertifikate) und `caddy_config`

6) GIVEN der `caddy` Service in `docker-compose.prod.yml`
   WHEN die Netzwerk-Konfiguration analysiert wird
   THEN ist er im selben privaten Netzwerk wie App und DB (aus Slice 13)

7) GIVEN der `caddy` Service in `docker-compose.prod.yml`
   WHEN die Service-Dependencies analysiert werden
   THEN haengt er vom `app` Service ab (`depends_on`)

8) GIVEN die `docker-compose.prod.yml` mit Caddy-Service
   WHEN `docker compose -f docker-compose.prod.yml config --quiet` ausgefuehrt wird
   THEN ist die Compose-Konfiguration valide (Exit-Code 0)

9) GIVEN eine `.env.example` im Repo-Root
   WHEN die Datei gelesen wird
   THEN enthaelt sie mindestens diese Required Vars: `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ALLOWED_EMAILS`, `DATABASE_URL`, `DOMAIN`

10) GIVEN die `.env.example`
    WHEN die Datei gelesen wird
    THEN enthaelt sie auch die bestehenden App-Vars: `OPENROUTER_API_KEY`, `REPLICATE_API_TOKEN`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_BUCKET`, `R2_PUBLIC_URL`

11) GIVEN die `.env.example`
    WHEN die Datei gelesen wird
    THEN enthaelt sie auch die DB-Credentials fuer Docker: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`

12) GIVEN die `.env.example`
    WHEN auf sensible Werte geprueft wird
    THEN enthaelt sie KEINE echten Secrets/Tokens/Passwoerter -- nur Platzhalter (z.B. `your-secret-here`, leere Werte oder Beschreibungen)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `__tests__/docker/caddy-env.test.ts`

<test_spec>
```typescript
// Tests fuer Caddyfile, docker-compose.prod.yml (Caddy-Erweiterung) und .env.example
// Strategie: Dateien als Text lesen und Struktur/Konfiguration validieren

// AC-1: DOMAIN Environment-Variable in Caddyfile
it.todo('should use DOMAIN environment variable as site address in Caddyfile')

// AC-2: Reverse Proxy zu app:3000
it.todo('should configure reverse proxy to app service on port 3000 in Caddyfile')

// AC-3: Caddy Service mit korrektem Image
it.todo('should define caddy service with caddy:2.11.2-alpine image in docker-compose.prod.yml')

// AC-4: Ports 80 und 443 exponiert
it.todo('should expose ports 80 and 443 on caddy service')

// AC-5: Caddyfile-Mount und persistente Volumes
it.todo('should mount Caddyfile and define caddy_data and caddy_config volumes')

// AC-6: Caddy im privaten Netzwerk
it.todo('should connect caddy service to the same private network as app and db')

// AC-7: depends_on app
it.todo('should set caddy depends_on app service')

// AC-8: Valide Compose-Konfiguration (Integration Command prueft live)
// Kein Unit-Test -- wird via docker compose config geprueft

// AC-9: Required Auth/Deployment Vars in .env.example
it.todo('should list AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, ALLOWED_EMAILS, DATABASE_URL, DOMAIN in env.example')

// AC-10: Bestehende App-Vars in .env.example
it.todo('should list OPENROUTER_API_KEY, REPLICATE_API_TOKEN, R2 vars in env.example')

// AC-11: DB-Credentials in .env.example
it.todo('should list POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB in env.example')

// AC-12: Keine echten Secrets
it.todo('should not contain real secrets or tokens in env.example')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| slice-13-dockerfile-compose | `docker-compose.prod.yml` mit `app` + `db` Services | Compose Config | Services `app` und `db` existieren im privaten Netzwerk |
| slice-13-dockerfile-compose | `Dockerfile` | Docker Build | App-Image baut erfolgreich |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `Caddyfile` | Caddy Config | -- (letzter Slice) | Reverse Proxy `{$DOMAIN}` -> `app:3000` |
| `docker-compose.prod.yml` (erweitert) | Compose Config | -- (letzter Slice) | Services `app` + `db` + `caddy` vollstaendig |
| `.env.example` | Dokumentation | -- (letzter Slice) | Alle Required Env-Vars dokumentiert |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `Caddyfile` -- Reverse Proxy Config mit DOMAIN-Variable und Weiterleitung an app:3000
- [ ] `docker-compose.prod.yml` -- AENDERUNG: +caddy Service mit Image, Ports, Volumes, Netzwerk, depends_on
- [ ] `.env.example` -- Alle Required Env-Vars mit Platzhaltern (Auth, DB, API Keys, Domain, Cloudflare R2)
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEIN Dockerfile aendern (Slice 13 Deliverable)
- KEIN `next.config.ts` aendern (Slice 12/13 Deliverable)
- KEIN TLS-Zertifikat manuell erstellen (Caddy uebernimmt das automatisch)
- KEINE bestehenden Services (`app`, `db`) in `docker-compose.prod.yml` aendern -- NUR den `caddy` Service hinzufuegen und ggf. Volumes-Section erweitern
- KEINE echten Credentials in `.env.example`

**Technische Constraints:**
- Caddy-Image: exakt `caddy:2.11.2-alpine` (siehe architecture.md Integrations)
- `{$DOMAIN}` als Caddy-Umgebungsvariable fuer flexible Domain-Konfiguration
- Caddy muss Ports 80 (HTTP->HTTPS Redirect) und 443 (HTTPS) exponieren
- `caddy_data` Volume ist PFLICHT (speichert SSL-Zertifikate persistent)
- `.env.example` muss ALLE Vars abdecken: Auth (4), DB (4), API Keys (2), Cloudflare R2 (5), Domain (1), optional Langsmith (3)
- App-Service Port 3000 wird NICHT mehr nach aussen exponiert (Caddy proxied) -- `ports` Mapping auf `app` Service entfernen falls vorhanden

**Referenzen:**
- Architecture: `specs/phase-6/2026-03-15-security-hardening/architecture.md` -- Section "Constraints & Integrations" (Caddy 2.11.2-alpine)
- Architecture: `specs/phase-6/2026-03-15-security-hardening/architecture.md` -- Section "Quality Attributes" (Auto-SSL, curl -I https://domain)
- Architecture: `specs/phase-6/2026-03-15-security-hardening/architecture.md` -- Section "Neue Dateien" (Caddyfile, .env.example)
- Bestehend: `.env` -- Referenz fuer existierende Env-Vars (NICHT kopieren, nur Var-Namen uebernehmen)
- Bestehend: `docker-compose.yml` -- Dev-Variante als Kontext
