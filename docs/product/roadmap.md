---
title: Roadmap
created: 2026-03-02
updated: 2026-03-02
---

# Roadmap: POD Design Studio

## Aktueller Stand

**Phase:** 0 – E2E Generate & Persist
**Status:** ⬜ Noch nicht gestartet
**Letztes Check-in:** 2026-03-02

### Wo stehe ich?
Vision und Phasen definiert. Noch kein Code. Nächster Schritt: Discovery für P0.1 starten.

## Aktuelle Prioritäten

### P0.1: Infrastruktur & erste Generation
**Warum zuerst?** Das technische Fundament: Next.js + Replicate + PostgreSQL (Docker) + R2. Ohne das geht nichts.

**Nächste Schritte:**
1. [ ] Discovery: Replicate API evaluieren (Pricing, Rate Limits, Webhook vs. Polling)
2. [ ] Next.js Projekt aufsetzen (App Router, Tailwind v4, TypeScript)
3. [ ] PostgreSQL (Docker) Schema: Projekte, Generierungen, Prompts
4. [ ] Cloudflare R2 Setup: Bucket, Upload/Download via signed URLs
5. [ ] API Route: Replicate → Bild generieren → R2 speichern → DB eintragen
6. [ ] Einfaches UI: Prompt-Input + Bild-Anzeige + Galerie

### P0.2: Prompt Builder (Kittl-Style)
**Warum als zweites?** Der Prompt Builder ist der Kern-Differenziator – visueller Baukasten statt Blind-Tippen.

**Referenz:** Kittl Prompt Builder (Screenshots dokumentiert)

**Kategorien (je 9 Optionen mit Bild-Preview):**
- Style: Oil Painting, Drawing, Comic, Flat Vector, Anime, Watercolor, Low Poly, Glossy 3D, Photography
- Perspective: Worms Eye, Birds Eye, POV, Extreme Long, Long, Medium, Medium Close, Close Up, Extreme Close
- Effects: Grunge, Retro Film, Duotone, Motion Blur, Glitch, Chromatic Aberration, Fisheye, Bokeh, High Contrast
- Colors: Clay, B&W, Ice, Citrus, Berries, Desert, Dark Forest, Pink & Purple, Natural
- Environment: Desert, Studio, Florals, Retro Setting, Jungle, Interior, Street, Nature, Beach
- Lighting: Soft, Cinematic, Golden Hour, Under, Top, Side, Backlight, Hard, Studio

**UX-Pattern:**
- Kategorie-Nav links, 3x3 Bild-Grid rechts
- Freitext-Feld + "Add to your prompt"
- "Surprise me" Button
- Alle Kategorien optional, Auswahl wird kumulativ zum Prompt hinzugefügt

**Nächste Schritte:**
1. [ ] Prompt Builder UI (Modal/Panel mit Kategorie-Navigation)
2. [ ] Kategorie-Daten als JSON (Label + Prompt-Snippet pro Option)
3. [ ] Preview-Bilder generieren (einmalig, je Kategorie gleiches Basis-Motiv)
4. [ ] Prompt-Komposition: Auswahl → fertiger Prompt
5. [ ] "Surprise me" Zufalls-Kombination
6. [ ] Freitext-Ergänzung

### P0.3: LLM Prompt-Assistent
**Warum nach dem Builder?** Der Builder gibt Struktur, der LLM-Assistent gibt Intelligenz.

**Nächste Schritte:**
1. [ ] LLM-basierte Prompt-Verbesserung (groben Prompt → detaillierten Prompt)
2. [ ] Negativ-Prompt-Vorschläge
3. [ ] Prompt-History und Favoriten

### P0.4: Multi-Model & Iteration
**Warum als viertes?** Verschiedene Modelle für verschiedene Stile. Schnelles Wechseln ist der Turbo.

**Nächste Schritte:**
1. [ ] Modell-Selector UI
2. [ ] Parameter-Panel (Guidance, Steps, Aspect Ratio)
3. [ ] Bild-Galerie mit Vergleich
4. [ ] Variation-Generator (gleicher Prompt, verschiedene Seeds)

## Offene Entscheidungen

| Entscheidung | Status | Deadline | Notizen |
|--------------|--------|----------|---------|
| Replicate Pricing Model | ⏳ Research | Vor P0.1 | Kosten pro Generation verstehen |
| Replicate: Webhook vs. Polling | ⏳ Research | P0.1 | Webhook braucht öffentliche URL → Cloudflare Worker? |
| LLM für Prompt-Assistent | ✅ Entschieden | P0.3 | OpenRouter API, Default: openai/gpt-oss-120b:exacto |
| PostgreSQL ORM: Prisma vs. Drizzle | ⏳ Entscheiden | P0.1 | Drizzle = leichter, Prisma = mehr Ecosystem |
| R2 Zugriff: Signed URLs vs. Public | ⏳ Entscheiden | P0.1 | Nur für eigenen Gebrauch → Public Bucket reicht? |

## Geparkt (Nicht jetzt)

| Was | Grund |
|-----|-------|
| User Authentication | Nur für eigenen Gebrauch |
| Spreadshirt Direct Upload | Phase 3, erst wenn Workflow steht |
| Fine-Tuning eigener Modelle | Phase 3, fortgeschritten |
| Bildbearbeitung / Editor | Phase 1 |
| Export / Upscaling | Phase 2 |

## Erledigtes

| Datum | Was |
|-------|-----|
| 2026-03-02 | Vision, Phasen und Roadmap definiert |
| 2026-03-02 | Kittl Prompt Builder analysiert (6 Kategorien, je 9 Optionen) |

## Nächste Roadmap-Session

**Wann:** Nach Abschluss von P0.1 (erste Bild-Generierung + R2 Storage funktioniert)
**Agenda:**
- Replicate API Erfahrungen auswerten (Kosten, Latenz, Webhook-Setup)
- R2 Storage Performance bewerten
- Prompt Builder Scope finalisieren
- Phase 0 Progress bewerten

---
*Letzte Aktualisierung: 2026-03-02*
