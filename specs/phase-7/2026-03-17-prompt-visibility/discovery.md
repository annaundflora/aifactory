# Feature: Prompt-Sichtbarkeit & Reuse

**Epic:** --
**Status:** Draft
**Wireframes:** -- (noch nicht erstellt)

---

## Problem & Solution

**Problem:**
- Wenn ein Referenz-Image (txt2img) im Assistant Chat oder Canvas Chat verwendet wird, sieht der User nur das Bild — nicht den Prompt, der es erzeugt hat
- User muss manuell zum Canvas Detail View navigieren, um den Prompt einer Generation nachzuschlagen
- Kreative Iteration (Prompt-Tweaking) erfordert unnötige Kontextwechsel
- Kein Tool am Markt bietet explizites Prompt-Diffing zwischen Variationen

**Solution:**
- Original-Prompt neben Referenz-Images im Chat sichtbar machen
- Prompt als Startpunkt für Variationen direkt im Chat-Kontext nutzbar machen
- Prompt-Transparenz als Lernhilfe und Effizienz-Booster

**Business Value:**
- Schnellere kreative Iteration (weniger Kontextwechsel)
- Bessere AI-Assistant-Antworten (Prompt als Kontext = Intention verstehen)
- User-Lernkurve beim Prompting beschleunigen (CHI 2024: Prompt-Sichtbarkeit = signifikant bessere Ergebnisse)
- Differenzierung: Prompt-Diffing ist Marktlücke

---

## Scope & Boundaries

> **OFFEN — noch nicht mit User abgestimmt**

| In Scope (Kandidaten) |
|------------------------|
| Prompt neben Referenz-Images in Chat/Canvas anzeigen |
| Prompt-Reuse: Copy & Edit im Chat-Kontext |
| AI-Assistant nutzt Prompt als zusätzlichen Kontext |
| Prompt-Diffing zwischen Variationen |
| Reverse Prompt / Describe-Feature |

| Out of Scope (Kandidaten) |
|---------------------------|
| Prompt-Suche über alle Generationen (eigenes Feature) |
| Keyword-Attention-Slider (PromptCharm-Style, zu komplex) |
| PNG-Metadata-Embedding (ComfyUI-Style) |

---

## Current State Reference

- **Prompt-Speicherung:** `generations` Tabelle speichert `prompt`, `promptMotiv`, `promptStyle`, `negativePrompt` pro Generation (`lib/db/schema.ts:51-98`)
- **Canvas Chat imageContext:** Bekommt bereits `image_url`, `prompt`, `model_id`, `model_params` — Prompt ist intern verfügbar, aber User sieht ihn nicht (`components/canvas/canvas-chat-panel.tsx`)
- **Assistant Chat:** Zeigt Bilder als 120x120 Thumbnails in User-Bubbles, kein Prompt sichtbar (`components/assistant/chat-thread.tsx`)
- **ProvenanceRow:** Zeigt Referenz-Images mit Rolle/Stärke-Labels, kein Prompt (`components/lightbox/provenance-row.tsx`)
- **Variation Popover:** Lädt Prompt aus Generation, erlaubt Bearbeitung — aber nur im Canvas-Tool, nicht im Chat (`components/canvas/popovers/variation-popover.tsx`)
- **Prompt-Komposition:** `lib/services/generation-service.ts:319-479` — composiert motiv + style + reference-guidance
- **Workspace Variation State:** `lib/workspace-state.tsx` — Context für Cross-Component Prompt-Sharing

---

## Context & Research

### Konkurrenz-Analyse

| Tool | Prompt-Sichtbarkeit | Reuse-Pattern | Besonderheit |
|------|---------------------|---------------|-------------|
| Midjourney | Prompt immer am Bild sichtbar | Remix Mode: Variation öffnet vorausgefüllten Prompt-Editor | `/describe` → 4 Prompt-Vorschläge aus Bild |
| ComfyUI | Prompt als JSON in PNG eingebettet | Bild auf Canvas = kompletter Workflow restored | "Bild IST der Workflow" |
| A1111 | PNG Info Tab: Drag & Drop zeigt Parameter | "Send to txt2img/img2img" 1-Klick-Reuse | CSV-Prompt-History |
| Leonardo.ai | Prompt auf jedem Community-Bild sichtbar | Remix-Button kopiert alles in Workspace | Prompt-Transparenz als Social Currency |
| Adobe Firefly | Toggle: User-Prompt vs. Enhanced-Prompt | Inline-Edit direkt am Ergebnis | Macht AI-Rewrite transparent |
| ChatGPT+DALL-E | Revised Prompt hinter Info-Button versteckt | Nicht prominent | Spannungsfeld: Clean UX vs. Transparenz |

### Wissenschaftliche Erkenntnisse

| Finding | Quelle | Relevanz |
|---------|--------|----------|
| Prompt-Sichtbarkeit beschleunigt Lernkurve | "Is It AI or Is It Me?" CHI 2024 | User lernen durch Beobachtung |
| Keyword-Attention-Slider verbessern Ergebnis-Qualität | PromptCharm CHI 2024 (24 TN) | Interaktive Prompts > statische |
| Eine Variable pro Iteration ändern = bestes Lernen | Mehrere Studien | UX sollte dafür optimieren |
| Kein Tool bietet explizites Prompt-Diffing | Lückenanalyse | Differenzierungschance |

### UX-Patterns (Best Practices)

| Pattern | Beschreibung | Wer macht es |
|---------|-------------|--------------|
| Prompt-as-Primary-Metadata | Prompt immer am Bild, nie versteckt | Midjourney, Leonardo |
| Pre-filled Edit on Variation | Original-Prompt vorausgefüllt zum Tweaken | Midjourney Remix |
| "Send to X" Routing | Prompt direkt in andere Modi schicken | A1111 |
| Prompt Toggle (Original vs. Enhanced) | Transparenz bei AI-Rewriting | Adobe Firefly |
| Variation Grid mit Prompt-Deltas | Zeigen was sich geändert hat | KEINER (Marktlücke!) |
| Reverse Prompt / Describe | Bild → Prompt-Vorschläge | Midjourney /describe |

### Ähnliche Patterns in Codebase

| Feature | Location | Relevant because |
|---------|----------|------------------|
| ProvenanceRow | `components/lightbox/provenance-row.tsx` | Zeigt bereits Referenz-Metadata (Rolle, Stärke) — Prompt wäre Erweiterung |
| Canvas imageContext | `components/canvas/canvas-chat-panel.tsx` | Prompt wird bereits intern übergeben, nur nicht angezeigt |
| Variation Popover | `components/canvas/popovers/variation-popover.tsx` | Prompt-Reuse-Pattern existiert bereits |
| DetailsOverlay | `components/canvas/details-overlay.tsx:102-143` | Zeigt Prompt-Felder bereits separat (motiv, style, negative) |

---

## Open Questions

| # | Question | Options | Recommended | Decision |
|---|----------|---------|-------------|----------|
| 1 | Welche Feature-Cluster sollen in Scope? | A) Nur Sichtbarkeit B) Sichtbarkeit + Reuse C) Alles inkl. Diffing + Describe | B) Standard | -- |
| 2 | Wie groß soll das Feature werden? (POC / Standard / Ambitioniert) | A) Minimal: Prompt anzeigen + Copy B) Standard: + Reuse + Chat-Integration C) Ambitioniert: + Diffing + Describe | B) Standard | -- |
| 3 | Wo genau Prompt anzeigen? | A) Nur Canvas Chat B) Nur Assistant Chat C) Beide Chats D) Beide + ProvenanceRow + Gallery | -- | -- |
| 4 | Prompt-Anzeige: Vollständig oder zusammengefasst? | A) Voller Prompt (motiv + style) B) Nur motiv, style on hover C) Collapsible (erste Zeile + expand) | C) Collapsible | -- |
| 5 | Soll der AI-Assistant den Prompt als Kontext bekommen? | A) Ja, automatisch B) Nur wenn User es anfordert C) Immer, aber nicht sichtbar für User | A) Automatisch | -- |
| 6 | Prompt-Reuse: Wo hin? | A) In Prompt-Area (Workspace) B) Inline im Chat editierbar C) Beides | -- | -- |
| 7 | Nur txt2img-Prompts oder auch img2img? | A) Nur txt2img B) Alle Modi | B) Alle Modi | -- |

---

## Research Log

| Date | Area | Finding |
|------|------|---------|
| 2026-03-17 | Codebase | Prompt-Daten bereits vollständig in DB (motiv, style, negative). Canvas Chat bekommt Prompt intern via imageContext. Kein UI zeigt Prompt im Chat-Kontext. |
| 2026-03-17 | Web/Konkurrenz | Midjourney: Prompt immer sichtbar + Remix Mode. ComfyUI: Prompt in PNG. A1111: "Send to" Pattern. Leonardo: Remix als Lern-Tool. |
| 2026-03-17 | Web/UX-Research | CHI 2024: Prompt-Sichtbarkeit = bessere Ergebnisse + schnelleres Lernen. Prompt-Diffing = Marktlücke. Jakob Nielsen: 6 Prompt-Augmentation-Patterns. |

---

## Q&A Log

| # | Frage | Antwort |
|---|-------|---------|
| 1 | Welche Ideen-Cluster findest du am spannendsten? (Kreativ-Workflow, AI-Assistant-Kontext, Effizienz, Organisation) | Alle vier Cluster sind relevant |
| 2 | Erst Recherche oder direkt Scope? | Erst Recherche |
| 3 | Scope & Ambitions-Level? | Session pausiert bevor Antwort gegeben wurde |
