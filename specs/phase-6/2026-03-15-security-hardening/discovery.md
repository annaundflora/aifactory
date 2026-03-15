# Feature: Security Hardening for Public Deployment

**Epic:** --
**Status:** Ready
**Wireframes:** --

---

## Problem & Solution

**Problem:**
- App hat zero Authentication — alle Server Actions sind anonym aufrufbar
- Keine User-Isolation — alle Daten (Projekte, Generierungen) sind ungeschützt zugänglich
- SSRF-Vulnerability in `uploadSourceImage` — beliebige URLs werden server-seitig gefetcht
- Keine Security Headers (CSP, HSTS, X-Frame-Options)
- Docker-Setup exposed DB-Port mit Default-Credentials
- Deployment auf Hetzner VPS geplant — App wird öffentlich erreichbar

**Solution:**
- Google OAuth + Email-Allowlist für Zugangskontrolle
- User-isolierte Daten via `userId` auf allen Tabellen
- SSRF-Fix via URL-Validierung
- Security Headers via Next.js config
- Docker-Härtung + Caddy Reverse Proxy für Production

**Business Value:**
- App kann sicher öffentlich deployed werden
- Daten sind pro User isoliert
- API-Kosten (Replicate, OpenRouter) geschützt vor Missbrauch

---

## Scope & Boundaries

| In Scope |
|----------|
| Authentication via Auth.js (v5) + Google OAuth Provider |
| Email-Allowlist (Env-Variable oder DB-Tabelle) |
| Login-Page mit Google Sign-In Button |
| Next.js Middleware für Route-Protection |
| Users-Tabelle in DB |
| `userId`-Spalte auf `projects`, `favorite_models` Tabellen |
| Ownership-Checks in allen Server Actions |
| SSRF-Fix: URL-Scheme + IP-Range Validierung in `uploadSourceImage` |
| Security Headers via `next.config.ts` (CSP, X-Frame-Options, HSTS, X-Content-Type-Options, Referrer-Policy) |
| Docker-Härtung: Private Network, starke DB-Credentials, kein exposed Port |
| Caddy Reverse Proxy Config mit automatischem SSL |
| Production Docker Compose mit App + DB + Caddy |
| Datenmigration: bestehende Daten einem Default-User zuweisen |

| Out of Scope |
|--------------|
| Admin-Dashboard für User-Management (1-5 User, Allowlist reicht) |
| Self-Service Registration / Invite-Flow |
| Role-Based Access Control (RBAC) |
| Rate Limiting (kann später ergänzt werden) |
| Audit Logging |
| Zweiter OAuth-Provider (GitHub) |
| Passwort-basierter Login |
| Two-Factor Authentication (2FA) |

---

## Current State Reference

> Greenfield — kein einziger Security-Mechanismus existiert.

- Kein Auth-Library in `package.json`
- Kein `middleware.ts`
- Kein `users`-Table in `lib/db/schema.ts`
- Kein `userId` auf `projects`, `generations`, `favorite_models` etc.
- Server Actions in `app/actions/*.ts` haben keine Auth-Checks
- `uploadSourceImage` in `app/actions/upload.ts:37` fetcht beliebige URLs
- `next.config.ts` hat keine Security Headers
- `docker-compose.yml` exposed Port 5432 mit Credentials `aifactory:aifactory_dev`

---

## UI Patterns

### Reused Patterns

| Pattern Type | Component | Usage in this Feature |
|--------------|-----------|----------------------|
| -- | -- | Keine wiederverwendbaren Security-UI-Patterns vorhanden |

### New Patterns

| Pattern Type | Description | Rationale |
|--------------|-------------|-----------|
| Login Page | Fullscreen-Page mit Google Sign-In Button, App-Logo, Fehlermeldung | Neuer Einstiegspunkt, existiert nicht |
| Auth Guard | Middleware redirected unauthentifizierte Requests zu Login | Kein bestehendes Pattern |

---

## User Flow

### Login Flow

1. User öffnet App-URL → Middleware erkennt: nicht authentifiziert → Redirect zu `/login`
2. User sieht Login-Page mit Google Sign-In Button
3. User klickt Google Sign-In → Google OAuth Consent Screen
4. User autorisiert → Redirect zurück zu App
5. Auth.js prüft: Email in Allowlist? → Ja → Session erstellt → Redirect zu `/` (Projects)
6. Auth.js prüft: Email in Allowlist? → Nein → Login-Page mit Fehlermeldung "Zugang nicht autorisiert"

### Logout Flow

1. User klickt Logout-Button (in Sidebar) → Session wird zerstört → Redirect zu `/login`

**Error Paths:**
- Google OAuth fehlgeschlagen → Login-Page mit Fehlermeldung "Login fehlgeschlagen. Bitte erneut versuchen."
- Email nicht in Allowlist → Login-Page mit Fehlermeldung "Kein Zugang. Bitte kontaktiere den Administrator."
- Session abgelaufen → Nächster Request → Redirect zu `/login`

---

## UI Layout & Context

### Screen: Login Page

**Position:** Eigenständige Route `/login`
**When:** User ist nicht authentifiziert

**Layout:**
- Zentrierter Container (max-width ~400px)
- App-Logo + App-Name oben
- Google Sign-In Button (primäre Aktion)
- Fehlermeldung darunter (nur sichtbar bei Fehler)

### Screen: Sidebar (Auth-Erweiterung)

**Position:** Bestehende Sidebar, unterer Bereich
**When:** User ist eingeloggt

**Layout:**
- User-Info: Avatar (Google Profilbild) + Name + Email
- Logout-Button

---

## UI Components & States

| Element | Type | Location | States | Behavior |
|---------|------|----------|--------|----------|
| `google_sign_in_btn` | Button | Login Page | `idle`, `loading` | Klick → OAuth Flow starten, während Redirect: Loading-State |
| `login_error_msg` | Alert | Login Page | `hidden`, `not_authorized`, `auth_failed` | `not_authorized`: "Kein Zugang. Bitte kontaktiere den Administrator." / `auth_failed`: "Login fehlgeschlagen. Bitte erneut versuchen." |
| `user_info` | Display | Sidebar unten | `visible` (immer wenn eingeloggt) | Zeigt: Google Avatar (32x32 rund), Display Name, Email |
| `logout_btn` | Button | Sidebar unten | `idle` | Klick → Session zerstören → Redirect `/login` |

---

## Feature State Machine

### States Overview

| State | UI | Available Actions |
|-------|----|--------------------|
| `unauthenticated` | Login Page | Google Sign-In |
| `authenticating` | Login Page, Button loading | -- (warten) |
| `not_allowed` | Login Page + Error "Kein Zugang" | Google Sign-In (erneut versuchen) |
| `auth_error` | Login Page + Error "Login fehlgeschlagen" | Google Sign-In (erneut versuchen) |
| `authenticated` | App (alle Routen) | Logout, alle bestehenden App-Features |

### Transitions

| Current State | Trigger | UI Feedback | Next State | Business Rules |
|---------------|---------|-------------|------------|----------------|
| `unauthenticated` | `google_sign_in_btn` -> click | Button → loading | `authenticating` | -- |
| `authenticating` | OAuth success + Email in Allowlist | Redirect zu `/` | `authenticated` | Email muss in `ALLOWED_EMAILS` sein |
| `authenticating` | OAuth success + Email NICHT in Allowlist | Error-Alert sichtbar | `not_allowed` | -- |
| `authenticating` | OAuth Fehler/Abbruch | Error-Alert sichtbar | `auth_error` | -- |
| `authenticated` | `logout_btn` -> click | Redirect zu `/login` | `unauthenticated` | Session wird zerstört |
| `authenticated` | Session expired + nächster Request | Redirect zu `/login` | `unauthenticated` | -- |

---

## Business Rules

- Nur Emails in der Allowlist dürfen sich einloggen
- Allowlist wird als Env-Variable `ALLOWED_EMAILS` gepflegt (kommasepariert)
- Jeder User sieht nur seine eigenen Projekte und Generierungen
- Server Actions prüfen Ownership: `project.userId === session.user.id`
- Unautorisierter Zugriff auf fremde Ressourcen gibt `{ error: "Not found" }` zurück (kein Informationsleck)
- Upload-URLs müssen `https://` Protokoll haben
- Upload-URLs dürfen nicht auf private IP-Ranges zeigen (127.x, 10.x, 172.16-31.x, 192.168.x, 169.254.x)
- Bestehende Daten werden bei Migration einem initialen Admin-User zugewiesen

---

## Data

| Field | Required | Validation | Notes |
|-------|----------|------------|-------|
| `users.id` | Yes | UUID, auto-generated | Primary Key |
| `users.email` | Yes | Unique, von Google OAuth | Wird gegen Allowlist geprüft |
| `users.name` | No | String, von Google OAuth | Display Name |
| `users.image` | No | URL, von Google OAuth | Avatar-URL |
| `users.createdAt` | Yes | Timestamp, auto-generated | -- |
| `projects.userId` | Yes | FK → users.id | Neue Spalte, NOT NULL nach Migration |
| `favorite_models.userId` | Yes | FK → users.id | Neue Spalte, ersetzt fehlende Zuordnung |
| `ALLOWED_EMAILS` | Yes | Kommasepariert, Email-Format | Env-Variable |

---

## Trigger-Inventory

| Trigger | Quelle | Aktion |
|---------|--------|--------|
| HTTP Request auf geschützte Route | Browser/Client | Middleware prüft Session → Redirect wenn unauthentifiziert |
| `signIn` Callback | Auth.js | Email gegen Allowlist prüfen → `true`/`false` |
| Jede Server Action | Client-Aufruf | Session prüfen → userId extrahieren → Ownership validieren |
| `uploadSourceImage` mit URL | Client-Aufruf | URL-Validierung (Scheme + IP-Range) vor `fetch()` |
| Docker Container Start | Deployment | Env-Variablen validieren (alle Required Secrets gesetzt?) |

---

## Implementation Slices

### Dependencies

```
Slice 1 (Auth Setup) → Slice 2 (DB Migration) → Slice 3 (Server Action Auth)
                                                       ↓
                                                 Slice 4 (SSRF Fix)
                                                       ↓
                                                 Slice 5 (Security Headers)
                                                       ↓
                                                 Slice 6 (Docker + Deployment)
```

### Slices

| # | Name | Scope | Testability | Dependencies |
|---|------|-------|-------------|--------------|
| 1 | Auth Setup + Login Page | Auth.js v5, Google OAuth Provider, Login Page UI, Middleware, Allowlist-Check im `signIn` Callback, Logout-Button in Sidebar | Login → OAuth → Redirect; Nicht-gelistete Email → Fehlermeldung; Unauthentifiziert → Redirect `/login` | -- |
| 2 | DB Migration + User-Isolation | Users-Tabelle, `userId` FK auf `projects` + `favorite_models`, Migration bestehender Daten zu Default-User | Neuer User erstellt Projekt → nur sein Projekt sichtbar; Bestehende Daten dem Default-User zugewiesen | Slice 1 |
| 3 | Server Action Authorization | Ownership-Checks in allen Server Actions (`generations.ts`, `projects.ts`, `references.ts`, `prompts.ts`, `models.ts`, `upload.ts`), Session-Validierung, `userId`-Filterung in Queries | Unautorisierter Zugriff auf fremde Ressource → `{ error: "Not found" }`; Kein Auth → `{ error: "Unauthorized" }` | Slice 2 |
| 4 | SSRF Fix | URL-Validierung in `uploadSourceImage`: Scheme-Check (`https://` only), IP-Range-Blocklist, DNS-Resolution-Check | `http://169.254.169.254/...` → rejected; `https://valid-image-host.com/img.png` → accepted; `file:///etc/passwd` → rejected | -- |
| 5 | Security Headers | `next.config.ts`: CSP, X-Frame-Options (DENY), X-Content-Type-Options (nosniff), Referrer-Policy (strict-origin-when-cross-origin), HSTS (max-age=31536000) | Response Headers prüfen via curl/DevTools | -- |
| 6 | Docker + Deployment | Production `docker-compose.prod.yml` (App + DB + Caddy), Caddy Config (auto-SSL, Reverse Proxy), Private Docker Network, starke DB-Credentials via `.env`, Dockerfile für Next.js App, `.env.example` mit allen Required Vars | `docker compose up` → App erreichbar via HTTPS → Login funktioniert → Generierung funktioniert | Slice 1-5 |

### Recommended Order

1. **Slice 1:** Auth Setup + Login Page — Fundament, alles andere baut darauf auf
2. **Slice 2:** DB Migration + User-Isolation — Datenmodell erweitern bevor Auth erzwungen wird
3. **Slice 3:** Server Action Authorization — Auth durchsetzen auf allen Endpoints
4. **Slice 4:** SSRF Fix — Unabhängig von Auth, kann parallel zu Slice 2-3
5. **Slice 5:** Security Headers — Einfach, unabhängig
6. **Slice 6:** Docker + Deployment — Alles zusammen deployen

---

## Context & Research

### Security Report Findings

| Finding | Severity | Confidence | Location |
|---------|----------|------------|----------|
| Full SSRF — User kontrolliert gesamte URL in `fetch()` | HIGH | 9/10 | `app/actions/upload.ts:37` |
| Zero Auth — alle 30+ Server Actions ohne Authentication | HIGH | 9/10 | `app/actions/*.ts` |
| Kein Users-Table, keine Multi-Tenancy | HIGH | 9/10 | `lib/db/schema.ts` |
| Keine Security Headers | MEDIUM | -- | `next.config.ts` |
| Docker: DB-Port exposed, Default-Credentials | MEDIUM | -- | `docker-compose.yml` |

### Similar Patterns in Codebase

| Feature | Location | Relevant because |
|---------|----------|------------------|
| Drizzle ORM Schema | `lib/db/schema.ts` | Neuer `users`-Table + FK-Spalten folgen gleichem Pattern |
| Server Actions | `app/actions/*.ts` | Auth-Checks werden in jede Action eingefügt |
| Docker Compose | `docker-compose.yml` | Production-Version baut darauf auf |

### Web Research

| Source | Finding |
|--------|---------|
| Auth.js v5 Docs | Next.js App Router native Integration, `auth()` Helper für Server Actions, `signIn` Callback für Allowlist |
| Next.js Security Headers | `headers()` in `next.config.ts` unterstützt alle gängigen Security Headers |
| Caddy Docs | Automatisches HTTPS via Let's Encrypt, einfachste Reverse-Proxy Config |
| OWASP SSRF Prevention | URL-Scheme Allowlist + IP-Range Blocklist + DNS-Resolution Validierung |

---

## Open Questions

| # | Question | Options | Recommended | Decision |
|---|----------|---------|-------------|----------|
| -- | -- | -- | -- | Alle Fragen geklärt |

---

## Research Log

| Date | Area | Finding |
|------|------|---------|
| 2026-03-15 | Codebase | Zero Auth: Kein middleware.ts, keine Auth-Library, kein Users-Table |
| 2026-03-15 | Codebase | 6 Server-Action-Dateien mit 30+ Actions, alle ohne Auth-Checks |
| 2026-03-15 | Codebase | SSRF in upload.ts:37 — `fetch(input.url)` ohne jede Validierung |
| 2026-03-15 | Codebase | Input-Validierung sonst gut: Regex, Type-Checks, Drizzle parametrisiert |
| 2026-03-15 | Codebase | Docker: postgres:16, Port 5432 exposed, Credentials hardcoded |
| 2026-03-15 | Codebase | next.config.ts: Nur viewTransition + image remotePatterns + assistant rewrite |
| 2026-03-15 | Security Report | SSRF Confidence 9/10, Auth-Bypass Confidence 9/10 (bei Public Deploy) |

---

## Q&A Log

| # | Frage | Antwort |
|---|-------|---------|
| 1 | Wie sollen die ausgewählten User Zugang erhalten? (Email-Allowlist, Invite-Code, Shared Password) | Email-Allowlist: Liste erlaubter Email-Adressen, Login via Google OAuth |
| 2 | Brauchen User eigene, getrennte Daten? (User-isoliert vs. shared Workspace) | Ja, User-isoliert: Jeder User sieht nur seine eigenen Projekte/Generierungen |
| 3 | Wie willst du auf Hetzner deployen? (VPS+Docker, Coolify, unklar) | VPS mit Docker Compose: Einzelner Hetzner VPS mit Caddy/Traefik als Reverse Proxy |
| 4 | Welchen OAuth-Provider? (Google, GitHub, Beide) | Google: Am verbreitetsten, einfaches Setup |
| 5 | Welcher Scope für Phase 6? (Alles, nur Auth+MT, nur Auth) | Alles: Auth + Multi-Tenancy + SSRF-Fix + Security Headers + Docker-Härtung + Deployment |
| 6 | Wie viele User initial? (1-5, 5-20, 20+) | 1-5 persönlich: Allowlist als Env-Variable reicht |
