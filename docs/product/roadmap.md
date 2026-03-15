---
title: Roadmap
created: 2026-03-02
updated: 2026-03-15
---

# Roadmap: POD Design Studio

## Aktueller Stand

**Phase:** 6 – Security, Hetzner & Deployment
**Status:** 🔄 In Arbeit
**Letztes Check-in:** 2026-03-15

### Wo stehe ich?
Phasen 0-5 sind abgeschlossen. Die App hat alle Features: E2E Generation, Prompt Builder, LLM Prompt-Assistent, Multi-Model, Model Cards, Multi-Image Referencing, Canvas Detail-View, Swiss Dark Warm Design System und Draft/Quality Mode. Nächster Schritt: Security Review und Deployment auf Hetzner.

## Aktuelle Prioritäten

### 🔴 P6.1: Security, Hetzner & Deployment
**Warum als nächstes?** App muss sicher sein und produktiv laufen.

**Nächste Schritte:**
1. [ ] Security Review (OWASP Top 10, API-Keys, Input Validation)
2. [ ] Rate Limiting
3. [ ] Docker Compose Production (Hetzner-optimiert)
4. [ ] Reverse Proxy & SSL (Let's Encrypt)
5. [ ] CI/CD Pipeline (GitHub Actions → Hetzner)
6. [ ] PostgreSQL Production + Backup
7. [ ] Domain, Health Checks, Monitoring
8. [ ] Deployment-Runbook

## Offene Entscheidungen

| Entscheidung | Status | Deadline | Notizen |
|--------------|--------|----------|---------|
| Default-Modelle für Draft/Quality | ✅ Entschieden | P5 | Implementiert in Draft/Quality Mode |
| Hetzner Server-Typ | ⏳ Research | P6 | CPX vs. CX, RAM/CPU für Next.js + PostgreSQL |
| Reverse Proxy | ⏳ Entscheiden | P6 | Caddy (einfacher) vs. Nginx (bewährter) |

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

### P7: Image Collections (geplant)
**Warum?** Design-Evolutionen (Sketch -> Mockup -> Model-Shot -> POD-Vorlage) sollen als zusammengehoerige Gruppen sichtbar und verwaltbar sein.

**Discovery:** `specs/phase-7/2026-03-15-collections/discovery.md` (Draft)

---

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
| 2026-03-14 | Roadmap neu definiert: Phase 5-6 |
| 2026-03-15 | **Phase 5:** Draft/Quality Mode implementiert & gemerged |

## Nächste Roadmap-Session

**Wann:** Nach Security Review abgeschlossen
**Agenda:**
- Security-Findings auswerten
- Hetzner Server-Auswahl finalisieren
- Go-Live Checkliste prüfen

---
*Letzte Aktualisierung: 2026-03-14*
