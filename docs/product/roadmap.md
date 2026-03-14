---
title: Roadmap
created: 2026-03-02
updated: 2026-03-14
---

# Roadmap: POD Design Studio

## Aktueller Stand

**Phase:** 5 – Draft/Quality Mode
**Status:** 🔄 Discovery in Arbeit
**Letztes Check-in:** 2026-03-14

### Wo stehe ich?
Phasen 0-4 sind abgeschlossen. Die App hat: E2E Generation, Prompt Builder, LLM Prompt-Assistent, Multi-Model Support, Model Cards, Multi-Image Referencing, Canvas Detail-View und Swiss Dark Warm Design System. Nächster Schritt: Modell-Auswahl durch Draft/Quality-Modus vereinfachen.

## Aktuelle Prioritäten

### 🔴 P5.1: Draft/Quality Mode
**Warum zuerst?** Vereinfacht den Workflow massiv: Statt Modell-Details zu kennen, wählt man nur "schnell" oder "gut". Modell-Zuordnung in Settings (global).

**Status:** Discovery in Arbeit

**Nächste Schritte:**
1. [x] Discovery starten
2. [ ] Architecture
3. [ ] Slices planen & implementieren
4. [ ] Settings-Page für Modell-Zuordnung
5. [ ] Draft/Quality Toggle im Workspace

### 🟡 P6.1: Security Review & Hetzner-Optimierung
**Warum als nächstes?** Vor dem Deployment muss die App sicher sein und für Hetzner optimiert werden.

**Nächste Schritte:**
1. [ ] OWASP Top 10 Audit (API Routes, Environment Variables, Input Validation)
2. [ ] Rate Limiting
3. [ ] Docker Compose für Production (Hetzner-optimiert)
4. [ ] Reverse Proxy Setup (Caddy/Nginx)
5. [ ] SSL & Backup-Strategie

### 🟢 P7.1: Deployment auf Hetzner
**Warum als letztes?** Alles muss stehen, bevor es live geht.

**Nächste Schritte:**
1. [ ] CI/CD Pipeline (GitHub Actions → Hetzner)
2. [ ] Domain & SSL (Let's Encrypt)
3. [ ] PostgreSQL Production Setup
4. [ ] Health Checks & Monitoring
5. [ ] Deployment-Runbook dokumentieren

## Offene Entscheidungen

| Entscheidung | Status | Deadline | Notizen |
|--------------|--------|----------|---------|
| Default-Modelle für Draft/Quality | ⏳ Discovery | P5.1 | Welche Modelle als Default für Draft vs. Quality? |
| Hetzner Server-Typ | ⏳ Research | P6.1 | CPX vs. CX, RAM/CPU für Next.js + PostgreSQL |
| Reverse Proxy | ⏳ Entscheiden | P6.1 | Caddy (einfacher) vs. Nginx (bewährter) |

## Gelöste Bugs

| Bug | Status | Phase |
|-----|--------|-------|
| Multi-Model Rate Limiting | ✅ Behoben | P2: Model Cards |
| Detail-View Fensterbreite | ✅ Behoben | P4: Canvas Detail-View |
| Vertikaler Overflow | ✅ Behoben | P4: Canvas Detail-View |
| Details-Overlay nicht gerendert | ✅ Behoben | P4: Canvas Detail-View |
| Tool-Popovers Positionierung | ✅ Behoben | P4: Canvas Detail-View |
| Chat-Panel nicht eingebunden | ✅ Behoben | P4: Canvas Detail-View |
| In-Place Generation Update | ✅ Behoben | P4: Canvas Detail-View |

## Geparkt (Nicht jetzt)

| Was | Grund |
|-----|-------|
| User Authentication | Nur für eigenen Gebrauch |
| Spreadshirt Direct Upload | Erst wenn Workflow produktiv läuft |
| Fine-Tuning eigener Modelle | Fortgeschritten, nach Deployment |
| Bildbearbeitung / Editor (Phase 1 alt) | Scope geändert, nicht mehr im Fokus |
| Export / Upscaling (Phase 2 alt) | Scope geändert, nicht mehr im Fokus |

## Erledigtes

| Datum | Was |
|-------|-----|
| 2026-03-02 | Vision, Phasen und Roadmap definiert |
| 2026-03-02 | Kittl Prompt Builder analysiert |
| 2026-03-07 | **Phase 0:** E2E Generate & Persist (21 Slices) |
| 2026-03-07 | **Phase 1:** Quality Improvements (DB, Sidebar, Prompts, Thumbnails) |
| 2026-03-11 | **Phase 2:** Generation UI, Model Cards, Multi-Mode Generation |
| 2026-03-13 | **Phase 3:** Multi-Image Referencing, Prompt Assistant |
| 2026-03-14 | **Phase 4:** Canvas Detail-View, UI Redesign (Swiss Dark Warm) |
| 2026-03-14 | Alle P4 Canvas-Bugs gefixt |
| 2026-03-14 | Roadmap neu definiert: Phase 5-7 |

## Nächste Roadmap-Session

**Wann:** Nach Abschluss von P5.1 (Draft/Quality Mode implementiert)
**Agenda:**
- Draft/Quality Erfahrungen auswerten
- Security Review Scope finalisieren
- Hetzner Server-Auswahl treffen
- Deployment-Timeline festlegen

---
*Letzte Aktualisierung: 2026-03-14*
