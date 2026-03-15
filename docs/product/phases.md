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
| 5 | Draft/Quality Mode | Einfach zwischen Draft und Quality wechseln statt Modelle manuell wählen? | ✅ |
| 6 | Security, Hetzner & Deployment | Ist die App sicher und läuft produktiv auf Hetzner? | 🔄 |

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

## Phase 5: Draft/Quality Mode ✅

**Frage:** Kann ich einfach zwischen Draft (schnell/günstig) und Quality (beste Ergebnisse) wechseln, statt Modelle manuell auszuwählen?

**Features:** Draft/Quality Toggle im Workspace, Settings-Page für Modell-Zuordnung (global scope)

**Abgeschlossen:** 2026-03-15

---

## Phase 6: Security, Hetzner & Deployment (AKTUELL)

**Frage:** Ist die App sicher und läuft produktiv auf Hetzner?

### Kriterien
- [ ] Security Review: OWASP Top 10, API-Keys, Environment Variables
- [ ] Rate Limiting & Input Validation
- [ ] Docker Compose Production Setup (Hetzner-optimiert)
- [ ] Reverse Proxy & SSL (Let's Encrypt)
- [ ] PostgreSQL Production Setup
- [ ] CI/CD Pipeline (GitHub Actions → Hetzner)
- [ ] Health Checks, Monitoring & Logging
- [ ] Backup-Strategie für PostgreSQL & R2
- [ ] Domain-Setup
- [ ] Deployment-Runbook

### Exit-Kriterium
> "Die App läuft sicher und stabil auf Hetzner, ich kann von überall darauf zugreifen und Designs generieren."

### Nicht in dieser Phase
- Auto-Scaling
- Multi-User Auth
- CDN für Bilder (R2 reicht)

---

## Phase 7: Image Collections

**Frage:** Kann ich zusammengehoerige Bilder (Design-Evolutionen) als Collections gruppieren und verwalten?

### Kriterien
- [ ] Automatische Collection-Bildung bei img2img/Variation im Canvas
- [ ] Sichtbare Collection-Indikatoren im Canvas
- [ ] Collection starten/aufheben/bearbeiten im Canvas
- [ ] Collections in Workspace-Galerie anzeigen und verwalten
- [ ] Interaktionsmuster (Drag&Drop, Kontextmenue, etc.)

### Exit-Kriterium
> "Wenn ich im Canvas eine Variation generiere, sehe ich sofort dass die Bilder zusammengehoeren. In der Galerie kann ich Collections als Einheit sehen und verwalten."

### Nicht in dieser Phase
- Collection-Export als ZIP/Bundle
- Collection-Sharing/Collaboration
- Cross-Project Collections

---
*Letzte Aktualisierung: 2026-03-15*
