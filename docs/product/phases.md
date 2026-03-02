---
title: Phasen-Definition
created: 2026-03-02
updated: 2026-03-02
---

# Phasen-Definition: POD Design Studio

## Übersicht

| Phase | Name | Kernfrage | Status |
|-------|------|-----------|--------|
| 0 | E2E Generate & Persist | Kann ich Designs generieren, iterieren und alles wird gespeichert? | ⬜ |
| 1 | Edit & Refine | Kann ich Designs direkt im Tool bearbeiten? | ⬜ |
| 2 | Export & Produce | Kommt ein POD-ready 4000x4000 Design raus? | ⬜ |
| 3 | Power Features | Wird der Workflow schneller als Kittl? | ⬜ |

---

## Phase 0: E2E Generate & Persist (AKTUELL)

**Frage:** Kann ich Designs generieren, iterieren und alles persistent speichern – ein kompletter E2E-Durchstich?

### Kriterien

**Infrastruktur:**
- [ ] Next.js App (App Router, Tailwind v4, TypeScript)
- [ ] PostgreSQL (Docker): Projekte, Generierungen, Prompts, Einstellungen
- [ ] Cloudflare R2: Bild-Storage (generierte Bilder persistent speichern)
- [ ] Replicate API-Anbindung (Webhook oder Polling für async Generation)

**Generation:**
- [ ] Modell-Auswahl (mind. FLUX Schnell, FLUX Pro, SDXL)
- [ ] Prompt-Eingabe mit Live-Preview der generierten Bilder
- [ ] Model-Parameter: Guidance Scale, Steps, Aspect Ratio konfigurierbar
- [ ] Variations: Schnell Varianten generieren (gleicher Prompt, anderer Seed)

**Prompt Builder (Kittl-Style):**
- [ ] Visueller Baukasten mit 6 Kategorien: Style, Perspective, Effects, Colors, Environment, Lighting
- [ ] Je 9 Optionen mit Bild-Preview (3x3 Grid)
- [ ] Freitext-Ergänzung + "Add to your prompt"
- [ ] "Surprise me" Zufalls-Kombination
- [ ] Prompt-Komposition: Auswahl → fertiger Prompt-String

**LLM Prompt-Assistent:**
- [ ] Prompt-Verbesserung via LLM (grob → detailliert)
- [ ] Negativ-Prompt-Vorschläge

**Persistenz & Galerie:**
- [ ] Bild-Galerie: Alle Generierungen sichtbar, persistent gespeichert
- [ ] Prompt-History: Vorherige Prompts wiederverwenden/anpassen
- [ ] Projekte: Generierungen in Projekten organisieren

### Exit-Kriterium
> "Ich kann mit dem Prompt Builder visuell einen Prompt zusammenklicken, zwischen Modellen wechseln, schnell iterieren – und alles wird in DB + R2 gespeichert. Beim nächsten Öffnen ist alles noch da."

### Nicht in dieser Phase
- Bildbearbeitung / Editor (kommt Phase 1)
- Export / Upscaling (kommt Phase 2)
- User Auth (nur für mich, kein Login nötig)

---

## Phase 1: Edit & Refine

**Frage:** Kann ich ein generiertes Design direkt im Tool bearbeiten?

### Kriterien
- [ ] Background Removal (via Replicate-Modell)
- [ ] Inpainting: Teile des Bildes mit AI neu generieren (FLUX Fill Pro / Kontext)
- [ ] Farbanpassungen (Helligkeit, Kontrast, Sättigung)
- [ ] Text-Overlay: Text auf Design platzieren (Schriftart, Größe, Farbe)
- [ ] Layer-System: Mehrere Elemente übereinander (Bild + Text + Grafik)
- [ ] Canvas: Feste Arbeitsfläche mit Zoom/Pan

### Exit-Kriterium
> "Ich kann ein generiertes Bild direkt im Tool verfeinern, ohne in Photoshop wechseln zu müssen."

### Nicht in dieser Phase
- 4000x4000 Export (kommt Phase 2)
- Batch-Export
- Vorlagen/Templates

---

## Phase 2: Export & Produce

**Frage:** Kommt am Ende ein POD-ready Design in der richtigen Qualität raus?

### Kriterien
- [ ] AI-Upscaling auf 4000x4000px (via Replicate Upscaler)
- [ ] PNG-Export mit Transparenz
- [ ] Spreadshirt-Preset: Korrekte DPI, Farbprofil, Dateigröße
- [ ] Export-Preview: Mockup auf T-Shirt/Hoodie vor dem Export

### Exit-Kriterium
> "Ich kann ein Design erstellen, bearbeiten und als druckfertiges 4000x4000px PNG exportieren, das direkt zu Spreadshirt hochgeladen werden kann."

### Nicht in dieser Phase
- Direkter Spreadshirt-Upload via API
- Batch-Verarbeitung

---

## Phase 3: Power Features

**Frage:** Wird der Workflow wirklich schneller und besser als mit Kittl?

### Kriterien
- [ ] Prompt-Templates: Bewährte Prompts als Vorlagen speichern
- [ ] Style-Presets: Häufig genutzte Stil-Kombinationen (Modell + Parameter)
- [ ] Batch-Generation: Mehrere Varianten gleichzeitig generieren
- [ ] Direkter Spreadshirt-Upload via API (optional)
- [ ] Design-History: Alle vergangenen Designs durchsuchbar
- [ ] Custom Fine-Tunes: Eigene Modelle über Replicate trainieren und nutzen

### Exit-Kriterium
> "Mein Workflow ist messbar schneller und flexibler als mit Kittl."

### Nicht in dieser Phase
- Multi-User Support
- Monetarisierung

---
*Letzte Aktualisierung: 2026-03-02*
