# Gate 1: Architecture Compliance Report

**Architecture:** `specs/phase-6/2026-03-15-security-hardening/architecture.md`
**Discovery:** `specs/phase-6/2026-03-15-security-hardening/discovery.md`
**Wireframes:** N/A (UI-minimal: Login Page + Sidebar Logout Button, bestaetigt in Discovery)
**Datum:** 2026-03-15
**Retry:** 2 (vorherige Blocking Issues gefixt)

---

## Summary

| Status | Count |
|--------|-------|
| PASS | 29 |
| WARNING | 0 |
| BLOCKING | 0 |

**Verdict:** APPROVED

---

## A) Feature Mapping

| # | Discovery Feature | Architecture Section | API Endpoint | DB Schema | Status |
|---|-------------------|---------------------|--------------|-----------|--------|
| 1 | Authentication via Auth.js v5 + Google OAuth | Auth Config (`auth.ts`), Auth Route Handler | `/api/auth/*` (GET/POST) | `users`, `accounts`, `sessions` | PASS |
| 2 | Email-Allowlist (Env-Variable) | Constraints, Validation Rules | `signIn` Callback | N/A (Env-Var) | PASS |
| 3 | Login-Page mit Google Sign-In Button | Architecture Layers: Login Page (`app/login/page.tsx`) | N/A (Page) | N/A | PASS |
| 4 | Next.js Middleware Route-Protection | Architecture Layers: Middleware (`middleware.ts`) | N/A (Middleware) | N/A | PASS |
| 5 | Users-Tabelle in DB | DB Schema: `users` table | N/A | `users` (id, name, email, emailVerified, image) | PASS |
| 6 | `userId` auf `projects`, `favorite_models` | DB Schema: geaenderte Tabellen | N/A | `projects.userId`, `favorite_models.userId` | PASS |
| 7 | Ownership-Checks in allen Server Actions | Server Logic: Auth Guard + Ownership Check Pattern | Alle Server Actions | userId-Filter in Queries | PASS |
| 8 | SSRF-Fix: URL-Scheme + IP-Range Validierung | Server Logic: URL Validator (`lib/security/url-validator.ts`), SSRF Prevention | N/A | N/A | PASS |
| 9 | Security Headers via `next.config.ts` | Migration Map: `next.config.ts` Target Pattern | N/A | N/A | PASS |
| 10 | Docker-Haertung: Private Network, starke Credentials | Migration Map: `docker-compose.yml`, Neue Dateien: `docker-compose.prod.yml` | N/A | N/A | PASS |
| 11 | Caddy Reverse Proxy + Auto-SSL | Neue Dateien: `Caddyfile`, Integrations: Caddy 2.11.2-alpine | N/A | N/A | PASS |
| 12 | Production Docker Compose | Neue Dateien: `docker-compose.prod.yml`, `Dockerfile` | N/A | N/A | PASS |
| 13 | Datenmigration bestehender Daten zu Default-User | Migration Strategy (7 Schritte dokumentiert) | N/A | `projects.userId`, `favorite_models.userId` | PASS |

---

## B) Constraint Mapping

| # | Constraint | Source | Architecture | Status |
|---|-----------|--------|-------------- |--------|
| 1 | Nur Allowlist-Emails duerfen einloggen | Discovery BR-1 | `signIn` Callback, case-insensitive Vergleich (Security Section) | PASS |
| 2 | User sieht nur eigene Projekte/Generierungen | Discovery BR-3 | Ownership Check Pattern: userId-Filter in allen Queries | PASS |
| 3 | Unautorisierter Zugriff gibt `{ error: "Not found" }` | Discovery BR-5 | Error Handling Strategy: "Not Found (Ownership)" | PASS |
| 4 | Upload-URLs muessen `https://` haben | Discovery BR-6 | URL Validation Rules: Protocol Check | PASS |
| 5 | Upload-URLs duerfen nicht auf private IPs zeigen | Discovery BR-7 | URL Validation Rules: Private IP Ranges (RFC 1918, Link-Local, Loopback) | PASS |
| 6 | Bestehende Daten Default-User zuweisen | Discovery BR-8 | Migration Strategy Schritt 2-7 | PASS |
| 7 | Google Avatar 32x32 rund in Sidebar | Discovery UI Components | Migration Map: `components/sidebar.tsx` Target: User-Info + Logout | PASS |
| 8 | Login Page: zentrierter Container ~400px | Discovery UI Layout | Neue Datei: `app/login/page.tsx` | PASS |
| 9 | Login Error States: `not_authorized`, `auth_failed` | Discovery State Machine | Error Handling Strategy: "Not Allowed" + "OAuth Error" | PASS |
| 10 | Session Cookie: HttpOnly, Secure, SameSite=Lax | Discovery (implizit Auth.js) | Data Protection: Auth.js Standard | PASS |
| 11 | `ALLOWED_EMAILS` kommasepariert, mind. 1 Email | Discovery Data | Validation Rules: `ALLOWED_EMAILS` Server-Start Fehler wenn leer | PASS |
| 12 | CSP, X-Frame-Options (DENY), HSTS, X-Content-Type-Options, Referrer-Policy | Discovery Scope | Migration Map: `next.config.ts` Target: Security Headers | PASS |

---

## C) Realistic Data Check

### Codebase Evidence

Gefundene Patterns in existierenden Schema-Definitionen (`lib/db/schema.ts`):

```
UUID Felder:       uuid("id") PK, uuid("project_id") FK -- Standard 36 chars
VARCHAR Felder:    varchar("name", { length: 255 })
                   varchar("model_id", { length: 255 })
                   varchar("status", { length: 20 })
                   varchar("replicate_prediction_id", { length: 255 })
                   varchar("original_filename", { length: 255 })
                   varchar("source_type", { length: 20 })
                   varchar("role", { length: 20 })
                   varchar("strength", { length: 20 })
                   varchar("generation_mode", { length: 20 })
                   varchar("thumbnail_status", { length: 20 })
TEXT Felder:       text("prompt"), text("image_url"), text("error_message")
                   text("thumbnail_url"), text("source_image_url")
                   text("prompt_motiv"), text("prompt_style")
                   text("negative_prompt")
TIMESTAMP:        timestamp("created_at", { withTimezone: true })
```

**Pattern-Zusammenfassung:** Das Projekt verwendet konsistent TEXT fuer URLs und variable Strings, VARCHAR(255) fuer IDs/Namen, VARCHAR(20) fuer Enum-artige Status-Felder, UUID fuer Primary/Foreign Keys.

### External API Analysis

| API | Field | Measured/Known Length | Sample | Arch Type | Recommendation |
|-----|-------|---------------------|--------|-----------|----------------|
| Google OAuth | `users.email` | Typ. 20-50 chars, max 254 chars (RFC 5321) | `user@gmail.com` | TEXT | PASS -- TEXT korrekt fuer externe Daten |
| Google OAuth | `users.name` | Typ. 5-50 chars, max unbegrenzt (Google Profile) | `Max Mustermann` | TEXT | PASS -- TEXT korrekt |
| Google OAuth | `users.image` | Typ. 80-150 chars (Google CDN URL) | `https://lh3.googleusercontent.com/a/...=s96-c` | TEXT | PASS -- TEXT korrekt fuer externe URLs |
| Google OAuth | `accounts.access_token` | 150-2048+ chars (variabel je nach Provider) | OAuth2 Bearer Token | TEXT | PASS -- TEXT korrekt |
| Google OAuth | `accounts.refresh_token` | 50-512 chars (variabel) | OAuth2 Refresh Token | TEXT | PASS -- TEXT korrekt |
| Google OAuth | `accounts.id_token` | 800-2000+ chars (JWT, variabel) | JWT Base64 | TEXT | PASS -- TEXT korrekt |
| Google OAuth | `accounts.providerAccountId` | Google Sub ID: 21 chars (numerisch) | `117084276831862314523` | TEXT | PASS -- TEXT korrekt (externe ID, Laenge kann sich aendern) |
| Google OAuth | `accounts.scope` | Typ. 50-200 chars | `openid email profile` | TEXT | PASS -- TEXT korrekt |
| Google OAuth | `accounts.token_type` | Typ. 6 chars | `bearer` | TEXT | PASS -- TEXT korrekt |
| Google OAuth | `accounts.session_state` | Variabel, Provider-spezifisch | -- | TEXT | PASS -- TEXT korrekt |
| Auth.js | `sessions.sessionToken` | 36 chars (UUID) oder laenger | UUID oder crypto token | TEXT | PASS -- TEXT korrekt (Auth.js kontrolliert Format) |

### Data Type Verdicts

| Field | Arch Type | Evidence | Verdict | Issue |
|-------|-----------|----------|---------|-------|
| `users.id` | UUID | Konsistent mit Codebase-Pattern (alle PKs sind UUID) | PASS | -- |
| `users.name` | TEXT | Google Profile Name, Laenge unkontrolliert | PASS | -- |
| `users.email` | TEXT | RFC 5321 max 254 chars, externe Quelle | PASS | -- |
| `users.emailVerified` | TIMESTAMP(tz) | Auth.js Standard, konsistent mit Codebase | PASS | -- |
| `users.image` | TEXT | Google CDN URL, konsistent mit bestehenden URL-Feldern (text) | PASS | -- |
| `accounts.userId` | UUID | FK, konsistent | PASS | -- |
| `accounts.type` | TEXT | Auth.js-kontrolliert ("oauth", "oidc", etc.) | PASS | -- |
| `accounts.provider` | TEXT | Auth.js-kontrolliert ("google") | PASS | -- |
| `accounts.providerAccountId` | TEXT | Google Sub ID, externe Quelle | PASS | -- |
| `accounts.refresh_token` | TEXT | OAuth Token, variable Laenge | PASS | -- |
| `accounts.access_token` | TEXT | OAuth Token, variable Laenge | PASS | -- |
| `accounts.expires_at` | INTEGER | Unix Timestamp, Auth.js Standard | PASS | -- |
| `accounts.token_type` | TEXT | OAuth Token Type String | PASS | -- |
| `accounts.scope` | TEXT | OAuth Scopes String | PASS | -- |
| `accounts.id_token` | TEXT | JWT, kann >1000 chars sein | PASS | -- |
| `accounts.session_state` | TEXT | Provider-spezifisch, variable Laenge | PASS | -- |
| `sessions.sessionToken` | TEXT | Auth.js generiert, Format variabel | PASS | -- |
| `sessions.userId` | UUID | FK, konsistent | PASS | -- |
| `sessions.expires` | TIMESTAMP(tz) | Konsistent mit Codebase-Pattern | PASS | -- |
| `projects.userId` | UUID | FK, konsistent | PASS | -- |
| `favorite_models.userId` | UUID | FK, konsistent | PASS | -- |
| `favorite_models.modelId` | VARCHAR(255) | Bereits bestehend im Schema, konsistent | PASS | -- |

**Zusammenfassung:** Alle Auth.js-Tabellen verwenden TEXT fuer Strings, was die korrekte Wahl ist. Der `@auth/drizzle-adapter` definiert dieses Schema offiziell. Die Datentypen sind konsistent mit den bestehenden Codebase-Patterns (TEXT fuer URLs und externe Daten, UUID fuer Keys).

---

## D) External Dependencies

### D1) Dependency Version Check

**Projekt-Typ:** Existing (package.json + Lock-File vorhanden)

| Dependency | Arch Version | Pinning File | Pinned? | "Latest"? | Actual Latest | Current? | Status |
|------------|-------------|--------------|---------|-----------|---------------|----------|--------|
| next-auth (Auth.js v5) | 5.0.0-beta.30 | package.json (neu) | N/A (noch nicht installiert) | Nein | 5.0.0-beta.30 (npm beta tag, verifiziert) | PASS | PASS |
| @auth/drizzle-adapter | 1.11.1 | package.json (neu) | N/A (noch nicht installiert) | Nein | 1.11.1 (npm latest, verifiziert) | PASS | PASS |
| Caddy Server | 2.11.2-alpine | docker-compose.prod.yml (neu) | Exakt gepinnt (alpine-Variante) | Nein | 2.11.2 (Docker Hub, verifiziert) | PASS | PASS |
| node Docker Base | 22.14.0-slim | Dockerfile (neu) | Exakt gepinnt (Patch-Level) | Nein | 22.22.1-slim (neuere Patches verfuegbar) | PASS | PASS |
| Next.js | 16.1.6 | package.json | PASS (exact pin) | Nein | -- (bereits installiert) | PASS | PASS |
| Drizzle ORM | 0.45.1 | package.json | PASS (^0.45.1) | Nein | -- (bereits installiert) | PASS | PASS |
| PostgreSQL | 16 | docker-compose.yml | PASS (postgres:16) | Nein | -- (bereits verwendet) | PASS | PASS |

**Hinweise:**
- Neue Dependencies (next-auth, @auth/drizzle-adapter) werden erst bei Implementation installiert. Die Architecture dokumentiert spezifische Versionen, die zum Pruefzeitpunkt aktuell sind.
- `node:22.14.0-slim` ist ein gueltiges LTS Release (Feb 2025). Neuere Patches (22.22.1) existieren, aber die Architecture pinnt bewusst auf Patch-Level fuer reproduzierbare Builds. Dies ist korrekte Praxis -- kein Blocking Issue.
- Docker Image Tags sind jetzt exakt gepinnt: `caddy:2.11.2-alpine` und `node:22.14.0-slim` (Fix von Issue 1 des vorherigen Reports).

### D2) External APIs & Services

| Dependency | Rate Limits | Auth | Errors | Timeout | Status |
|------------|-------------|------|--------|---------|--------|
| Google OAuth 2.0 | Google Free Tier (kein Rate Limit fuer <100 User) | OAuth 2.0 Client Credentials (AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET) | Auth.js managed (error page redirect) | Auth.js Default | PASS |
| Let's Encrypt (via Caddy) | 50 Certs/Domain/Week, 300 New Orders/3h | ACME Protocol (automatisch via Caddy) | Caddy Fallback zu ZeroSSL (dokumentiert in Risks) | Caddy managed | PASS |

---

## E) Migration Completeness

### Quantitaets-Check

| Discovery Claim | Architecture Coverage | Status |
|---|---|---|
| 6 Server Action Dateien mit Auth-Checks | Migration Map: 6 Server Action Dateien (projects, generations, references, prompts, models, upload) | PASS |
| users-Tabelle + userId auf projects + favorite_models | DB Schema: 3 neue Tabellen + 2 geaenderte Tabellen | PASS |
| Sidebar + Layout + next.config + docker-compose | Migration Map: 4 weitere Dateien (sidebar, layout, next.config, docker-compose) | PASS |
| Gesamt: Discovery nennt kein "N Dateien" explizit | Migration Map: 12 existierende Dateien + 12 neue Dateien | PASS |

### Qualitaets-Check

| File in Migration Map | Current Pattern | Target Pattern | Specific enough for test? | Status |
|---|---|---|---|---|
| `lib/db/schema.ts` | 8 Tabellen ohne User-Bezug | +3 Auth.js Tabellen, +userId FK auf projects/favorite_models | Yes: `expect(schema).toContain("users")` + FK Checks | PASS |
| `lib/db/queries.ts` | Queries ohne userId-Filter | Alle Queries mit userId-Parameter | Yes: `expect(getProjects).toHaveParam("userId")` | PASS |
| `app/actions/projects.ts` | Keine Auth-Checks | requireAuth() + userId-Filter | Yes: `expect(content).toContain("requireAuth()")` | PASS |
| `app/actions/generations.ts` | Keine Auth-Checks | requireAuth() + Ownership via projectId | Yes: `expect(content).toContain("requireAuth()")` | PASS |
| `app/actions/references.ts` | Keine Auth-Checks | requireAuth() + Ownership via projectId | Yes: `expect(content).toContain("requireAuth()")` | PASS |
| `app/actions/prompts.ts` | Keine Auth-Checks | requireAuth() + Ownership via projectId | Yes: `expect(content).toContain("requireAuth()")` | PASS |
| `app/actions/models.ts` | Keine Auth-Checks, favoriteModels ohne User | requireAuth() + userId-Filter auf favoriteModels + Project-Ownership fuer selectedModels | Yes: `expect(content).toContain("requireAuth()")` | PASS |
| `app/actions/upload.ts` | Keine Auth-Checks, keine URL-Val | requireAuth() + validateUrl() vor fetch() | Yes: `expect(content).toContain("validateUrl")` | PASS |
| `app/layout.tsx` | ThemeProvider + ToastProvider | +SessionProvider wrapping | Yes: `expect(content).toContain("SessionProvider")` | PASS |
| `components/sidebar.tsx` | SidebarFooter mit "Back to Overview" | +User-Info + Logout-Button | Yes: `expect(content).toContain("signOut")` | PASS |
| `next.config.ts` | Keine Headers, kein standalone | +Security Headers, +output: "standalone" | Yes: `expect(content).toContain("X-Frame-Options")` | PASS |
| `docker-compose.yml` | Port exposed, Dev-only | Kommentar: "Development only" | Yes: Kommentar-Check | PASS |

---

## F) Completeness Check

| Check | Status | Notes |
|-------|--------|-------|
| Alle External APIs identifiziert? | PASS | Google OAuth 2.0, Let's Encrypt (via Caddy) |
| Rate Limits dokumentiert? | PASS | Google Free Tier, Let's Encrypt via Caddy |
| Error Responses geplant? | PASS | Error Handling Strategy mit 6 Error Types |
| Auth-Flows komplett? | PASS | Login, Logout, Session Expired, Not Allowed, OAuth Error |
| Timeouts definiert? | PASS | Auth Latency <3s, Session Maxage 30 Tage |
| Architecture Template Sections? | PASS | Alle Sections vorhanden und ausgefuellt |

---

## G) Previous Blocking Issues -- Resolution Verification

### Issue 1 (RESOLVED): Docker Image Tags nicht exakt gepinnt

**Previous Problem:** Caddy und Node Docker Image Tags waren nicht auf Patch-Level gepinnt.

**Fix Verification:**
- Architecture Integrations-Tabelle Zeile 370: `Caddy Server | Docker Image | 2.11.2-alpine` -- exakt gepinnt mit Alpine-Variante
- Architecture Integrations-Tabelle Zeile 371: `node | Docker Image | 22.14.0-slim` -- exakt gepinnt auf Patch-Level

**Status:** RESOLVED

### Issue 2 (RESOLVED): project_selected_models fehlt in Ownership-Strategie

**Previous Problem:** `project_selected_models` fehlte in der Ownership-Dokumentation und Migration Map fuer `models.ts`.

**Fix Verification:**
- Architecture Zeile 211: Ownership Check Pattern listet jetzt explizit `project_selected_models` unter "Indirekte Ownership": `generations, reference_images, assistant_sessions, project_selected_models erben Ownership via projectId -> projects.userId`
- Architecture Zeile 326: Migration Map fuer `models.ts` erweitert: `requireAuth() + userId-Filter auf favoriteModels + Project-Ownership fuer selectedModels` mit spezifischem Hinweis auf `getProjectSelectedModels` und `saveProjectSelectedModels`

**Status:** RESOLVED

---

## Blocking Issues

Keine.

---

## Recommendations

1. **[Info]** `node:22.14.0-slim` ist ein gueltiges LTS Release, aber nicht das neueste Patch (22.22.1 verfuegbar). Fuer Production-Deployment empfohlen, bei naechster Gelegenheit auf das neueste Patch zu aktualisieren. Kein Blocking Issue, da die Architecture bewusst auf Patch-Level pinnt.
2. **[Info]** `generation_references` Tabelle ist nicht explizit in der Ownership-Dokumentation erwaehnt, erbt aber Ownership transitiv via `generations.generationId -> generations.projectId -> projects.userId`. Kein Server Action greift direkt auf `generation_references` zu -- Zugriff erfolgt nur via Service Layer. Akzeptabel.
3. **[Info]** `getPromptHistoryQuery` und `getFavoritesQuery` in `lib/db/queries.ts` verwenden Raw SQL ohne userId-Filter. Bei der Implementation (Slice 3) muss ein JOIN ueber `generations -> projects` auf `projects.userId` ergaenzt werden. Dies ist durch das Architecture-Pattern "Ownership via projectId->userId" abgedeckt, erfordert aber Aufmerksamkeit bei der Implementation.
4. **[Info]** Die Migration-Nummerierung (`drizzle/0007_auth_tables.sql`, `drizzle/0008_add_user_id.sql`) ist konsistent mit den bestehenden 7 Migrations (0000-0006).
5. **[Info]** `postgres:16` im Dev-Compose ist nicht auf Patch-Level gepinnt (aktuell: 16.13). Fuer die Development-Umgebung akzeptabel, fuer Production-Compose sollte gepinnt werden.

---

## Verdict

**Status:** APPROVED

**Blocking Issues:** 0
**Warnings:** 0

**Next Steps:**
- [ ] Architecture ist bereit fuer Slice-Planung
- [ ] Bei Slice 3 (Server Action Authorization): Besondere Aufmerksamkeit auf `prompts.ts` Raw SQL Queries (userId-Filter via JOIN ergaenzen)
- [ ] Bei Slice 6 (Docker): `postgres` Image in `docker-compose.prod.yml` ebenfalls auf Patch-Level pinnen
