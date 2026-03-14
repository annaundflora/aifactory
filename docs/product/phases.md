---
title: Phasen-Definition
created: 2026-03-02
updated: 2026-03-14
---

# Phasen-Definition: POD Design Studio

## Übersicht

| Phase | Name | Kernfrage | Status |
|-------|------|-----------|--------|
| 0 | E2E Generate & Persist | Kann ich Designs generieren, iterieren und alles wird gespeichert? | ✅ |
| 1 | Quality Improvements | Ist die Codebasis sauber, Sidebar richtig, DB-Schema stabil? | ✅ |
| 2 | Generation UI & Model Cards | Sind UI und Multi-Model-Workflow production-ready? | ✅ |
| 3 | Multi-Image & Prompt Assistant | Kann ich mit mehreren Bildern referenzieren und Prompts assistiert verbessern? | ✅ |
| 4 | Canvas Detail-View & UI Redesign | Ist die Detail-Ansicht und das UI-Redesign umgesetzt? | ✅ |
| 5 | Draft/Quality Mode | Einfach zwischen Draft und Quality wechseln statt Modelle manuell wählen? | 🔄 |
| 6 | Security & Hetzner-Optimierung | Ist die App sicher und ready für Hetzner? | ⬜ |
| 7 | Deployment | Läuft die App produktiv auf Hetzner? | ⬜ |

---

## Phase 0: E2E Generate & Persist ✅

**Frage:** Kann ich Designs generieren, iterieren und alles persistent speichern?

**Features:** Next.js App, PostgreSQL, Cloudflare R2, Replicate API, Prompt Builder, LLM Prompt-Assistent, Galerie, Prompt-History, Projekte

**Abgeschlossen:** 2026-03-07

---

## Phase 1: Quality Improvements ✅

**Frage:** Ist die Codebasis sauber und stabil?

**Features:** DB-Schema-Refactoring, shadcn Sidebar, Structured Prompts, Prompt History, Thumbnail Service, Lightbox Fullscreen, OpenRouter Timeout

**Abgeschlossen:** 2026-03-07

---

## Phase 2: Generation UI & Model Cards ✅

**Frage:** Sind UI und Multi-Model-Workflow production-ready?

**Features:** Generation UI Improvements, Model Cards, Multi-Mode Generation

**Abgeschlossen:** 2026-03-11

---

## Phase 3: Multi-Image & Prompt Assistant ✅

**Frage:** Kann ich mehrere Bilder referenzieren und Prompts assistiert verbessern?

**Features:** Multi-Image Referencing, Prompt Assistant

**Abgeschlossen:** 2026-03-13

---

## Phase 4: Canvas Detail-View & UI Redesign ✅

**Frage:** Ist die Detail-Ansicht und das UI-Redesign umgesetzt?

**Features:** Canvas Detail-View, UI Redesign (Swiss Dark Warm Design System)

**Abgeschlossen:** 2026-03-14

---

## Phase 5: Draft/Quality Mode (AKTUELL)

**Frage:** Kann ich einfach zwischen Draft (schnell/günstig) und Quality (beste Ergebnisse) wechseln, statt Modelle manuell auszuwählen?

### Kriterien
- [ ] Draft/Quality Toggle im Workspace (ersetzt direkte Modell-Auswahl)
- [ ] Settings-Page: Modell-Zuordnung für Draft und Quality (global scope)
- [ ] Bestehende Modell-Auswahl UI durch Draft/Quality ersetzen
- [ ] Default-Modelle vorkonfiguriert (z.B. Draft = FLUX Schnell, Quality = FLUX Pro)

### Exit-Kriterium
> "Ich wähle nur Draft oder Quality – das richtige Modell wird automatisch verwendet. In Settings kann ich jederzeit ändern, welches Modell hinter Draft/Quality steckt."

### Nicht in dieser Phase
- Security-Härtung (kommt Phase 6)
- Deployment (kommt Phase 7)

---

## Phase 6: Security & Hetzner-Optimierung

**Frage:** Ist die App sicher und bereit für Produktiv-Betrieb auf Hetzner?

### Kriterien
- [ ] Security Review: OWASP Top 10, API-Keys, Environment Variables
- [ ] Rate Limiting & Input Validation
- [ ] Hetzner-spezifische Optimierungen (Docker Compose, Reverse Proxy, SSL)
- [ ] Monitoring & Logging Basics
- [ ] Backup-Strategie für PostgreSQL & R2

### Exit-Kriterium
> "Die App ist sicherheitstechnisch geprüft und für Hetzner-Deployment vorbereitet."

### Nicht in dieser Phase
- Tatsächliches Deployment (kommt Phase 7)
- Multi-User Auth

---

## Phase 7: Deployment

**Frage:** Läuft die App produktiv auf Hetzner?

### Kriterien
- [ ] CI/CD Pipeline (GitHub Actions → Hetzner)
- [ ] Docker Compose Production Setup
- [ ] Domain & SSL (Let's Encrypt)
- [ ] PostgreSQL Production (Hetzner oder managed)
- [ ] Health Checks & Basic Monitoring
- [ ] Dokumentation: Deployment-Runbook

### Exit-Kriterium
> "Die App läuft stabil auf Hetzner, ich kann von überall darauf zugreifen und Designs generieren."

### Nicht in dieser Phase
- Auto-Scaling
- CDN für Bilder (R2 reicht)

---
*Letzte Aktualisierung: 2026-03-14*
