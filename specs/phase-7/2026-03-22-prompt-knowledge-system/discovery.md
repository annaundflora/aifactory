# Feature: Model-Aware Prompt Knowledge System

**Epic:** --
**Status:** Ready
**Wireframes:** -- (kein UI-Change)

---

## Problem & Solution

**Problem:**
- Der Prompt Improver hat nur flache, einzeilige Modell-Hints (z.B. "FLUX models: Detailed scene descriptions, specific art styles")
- Der Assistant kennt das vom User gewaehlte Bildgenerierungs-Modell nicht und kann keine modellspezifischen Prompt-Tipps geben
- Der Canvas Chat hat kein Prompting-Wissen und optimiert Prompts nicht fuer das aktuelle Modell
- Alle 3 Systeme ignorieren den Generierungs-Modus (txt2img vs img2img) bei der Prompt-Erstellung
- Umfangreiches Prompting-Wissen aus professionellen Quellen existiert (best-practices-prompting.md), wird aber nicht genutzt

**Solution:**
- Zentrale Prompt-Knowledge-Datei (`/data/prompt-knowledge.json`) mit modell- und modus-spezifischem Wissen
- Deterministisches Prefix-Matching (Model-ID -> Knowledge-Sektion)
- System-Prompt-Injection in alle 3 Systeme (Improver, Assistant, Canvas Chat)

**Business Value:**
- Hoehere Prompt-Qualitaet = bessere Bildqualitaet = zufriedenere User
- Modellspezifische Optimierung nutzt die Staerken jedes Modells voll aus
- Modus-Awareness verhindert kontraproduktive Prompt-Muster (z.B. Quality-Tags bei Flux)

---

## Scope & Boundaries

| In Scope |
|----------|
| Knowledge-Datei mit Prompting-Wissen fuer 8 Modell-Familien: Flux 2, Nano Banana 2, GPT Image 1.5, Seedream 4.5/5, Stable Diffusion, Recraft V4, Ideogram, Hunyuan |
| Prefix-basiertes Matching: Model-ID -> Knowledge-Sektion |
| Modus-spezifisches Wissen (txt2img, img2img) |
| System-Prompt-Injection im Improver (prompt-service.ts) |
| Dynamische System-Prompt-Injection im Assistant (prompts.py) |
| System-Prompt-Erweiterung im Canvas Chat (canvas_graph.py) |
| Verbesserung der recommend_model Logik mit Knowledge-Daten |

| Out of Scope |
|--------------|
| RAG / Embedding-basierte Retrieval |
| Nicht-Replicate-Modelle (Midjourney, Adobe Firefly) |
| UI-Aenderungen (keine neuen Buttons, Screens oder Komponenten) |
| Neues LLM-Tool (kein get_prompting_tips Tool) |
| Inpaint/Outpaint/Upscale-spezifisches Prompting-Wissen |
| Automatische Aktualisierung der Knowledge-Datei |

---

## Current State Reference

> Existierende Funktionalitaet die wiederverwendet wird (unveraendert):

- Improver Modal UI (Side-by-Side, Adopt/Discard) — `components/prompt-improve/llm-comparison.tsx`
- Improver Server Action Flow (prompt + modelId) — `app/actions/prompts.ts`
- OpenRouter Client — `lib/clients/openrouter.ts`
- Assistant LangGraph Agent (Tools, SSE-Streaming, Sessions) — `backend/app/agent/`
- Canvas Chat LangGraph Agent (generate_image Tool, SSE) — `backend/app/agent/canvas_graph.py`
- Model Registry + Capability Detection + Sync — `lib/services/model-sync-service.ts`
- Model Display Name Utility — `lib/utils/model-display-name.ts`
- Prompt-Felder (promptMotiv, promptStyle, negativePrompt)
- Generation-Modi (txt2img, img2img, upscale, inpaint, outpaint)
- Tier-System (draft, quality, max)

---

## UI Patterns

### Reused Patterns

Keine UI-Aenderungen. Alle bestehenden UI-Patterns bleiben unveraendert.

### New Patterns

Keine neuen UI-Patterns.

---

## User Flow

> Die User Flows aendern sich NICHT. Die Verbesserung ist unsichtbar — die System-Prompts werden im Hintergrund angereichert.

**Improver:**
1. User klickt "Improve Prompt" -> System laedt modell- UND modus-spezifisches Wissen -> LLM erhaelt angereicherten System-Prompt -> Verbesserter Prompt nutzt Modell-Staerken

**Assistant:**
1. User oeffnet Assistant -> System erkennt ausgewaehltes Bildmodell + Modus -> System-Prompt enthaelt modellspezifisches Prompting-Wissen -> Assistant gibt modelloptimierte Prompt-Tipps

**Canvas Chat:**
1. User oeffnet Canvas Chat auf einem Bild -> System erkennt Modell aus image_context -> System-Prompt enthaelt Prompting-Wissen fuer dieses Modell -> Canvas Chat optimiert Prompts modellspezifisch

**recommend_model:**
1. Assistant sammelt User-Intent -> recommend_model nutzt Knowledge-Daten fuer praezisere Matching-Regeln -> Empfehlung beruecksichtigt Use-Case-Staerken der Modelle

---

## Business Rules

- Knowledge wird NUR fuer aktive Replicate-Modelle gepflegt
- Wenn kein Knowledge-Match fuer ein Modell gefunden wird: generisches Prompting-Wissen als Fallback
- Prefix-Matching: Der laengste passende Prefix gewinnt (z.B. "flux-2-pro" matcht vor "flux-2" vor "flux")
- Knowledge-Datei muss von TypeScript (Next.js) UND Python (FastAPI) lesbar sein
- Modus-Wissen ist optional pro Modell — wenn nicht vorhanden, nur allgemeines Modell-Wissen injizieren
- Gesamtes injiziertes Wissen pro Request: max ~500 Tokens (Modell-Sektion + Modus-Sektion)

---

## Data

### Knowledge-Datei Struktur

| Feld | Required | Beschreibung |
|------|----------|--------------|
| `models` | Ja | Objekt mit Model-Prefix als Key |
| `models.{prefix}.displayName` | Ja | Menschenlesbarer Modellname (z.B. "Flux 2 Pro/Max") |
| `models.{prefix}.promptStyle` | Ja | Prompt-Stil: "natural" oder "keywords" |
| `models.{prefix}.negativePrompts` | Ja | Unterstuetzt Negative Prompts: true/false + Workaround |
| `models.{prefix}.strengths` | Ja | Liste der Modell-Staerken (2-4 Eintraege) |
| `models.{prefix}.tips` | Ja | Modellspezifische Prompt-Tipps (3-6 Eintraege) |
| `models.{prefix}.avoid` | Ja | Was bei diesem Modell vermieden werden soll (2-4 Eintraege) |
| `models.{prefix}.modes` | Nein | Modus-spezifische Tipps |
| `models.{prefix}.modes.txt2img` | Nein | Tipps fuer Text-to-Image Modus |
| `models.{prefix}.modes.img2img` | Nein | Tipps fuer Image-to-Image Modus |
| `fallback` | Ja | Generisches Prompting-Wissen wenn kein Modell-Match |

### Abgedeckte Modelle (Knowledge-Prefixe)

| Prefix | Matcht | Wissensquelle |
|--------|--------|---------------|
| `flux-2` | flux-2-pro, flux-2-max, flux-2-flex | best-practices-prompting.md |
| `flux-schnell` | flux-schnell | best-practices-prompting.md (reduziert) |
| `nano-banana` | nano-banana-2, nano-banana-pro | best-practices-prompting.md + Web-Recherche (abgeschlossen) |
| `gpt-image` | gpt-image-1.5 | best-practices-prompting.md |
| `seedream` | seedream-4.5, seedream-5, seedream-5-lite | best-practices-prompting.md + Web-Recherche (abgeschlossen) |
| `stable-diffusion` | stable-diffusion-3.5-*, sd3.5-* | best-practices-prompting.md |
| `recraft` | recraft-v4, recraft-v4-* | best-practices-prompting.md |
| `ideogram` | ideogram-3, ideogram-* | best-practices-prompting.md |
| `hunyuan` | hunyuan-image-3, hunyuan-* | best-practices-prompting.md |

---

## Integration: Aenderungen pro System

### 1. Improver (prompt-service.ts)

**Ist-Zustand:** `buildSystemPrompt()` hat statische, einzeilige Hints pro Modell-Familie
**Aenderung:**
- Knowledge-Datei laden und nach Model-ID + Modus filtern
- Gefilterte Sektion in den System-Prompt injizieren (ersetzt die statischen Hints)
- Neuer Input: `generationMode` (txt2img/img2img) neben `modelId`

### 2. Assistant (prompts.py + graph.py)

**Ist-Zustand:** Statischer System-Prompt ohne Modell-Awareness, kennt das gewaehlte Bildmodell nicht
**Aenderung:**
- System-Prompt wird dynamisch (wie Canvas Chat bereits): Bildmodell-Info + Prompting-Wissen injizieren
- Der Assistant erhaelt das aktuell gewaehlte Bildmodell + Modus als Teil der Message-Payload (Frontend sendet diese Metadaten mit jeder Nachricht)
- System-Prompt enthaelt modellspezifische Prompting-Regeln
- `draft_prompt` und `refine_prompt` Tools profitieren indirekt (LLM hat Modell-Kontext)

### 3. Canvas Chat (canvas_graph.py)

**Ist-Zustand:** System-Prompt erhaelt `model_id` aus image_context, aber kein Prompting-Wissen
**Aenderung:**
- `build_canvas_system_prompt()` laedt Knowledge fuer das aktuelle Modell
- Prompting-Tipps werden in den injizierten Kontext aufgenommen

### 4. recommend_model (model_tools.py)

**Ist-Zustand:** Statische Keyword-basierte Matching-Regeln (5 Kategorien)
**Aenderung:**
- Matching-Regeln werden aus Knowledge-Datei angereichert
- Use-Case-Staerken der Modelle fliessen in die Empfehlung ein
- Begruendungen werden praeziser (z.B. "Flux 2 Pro eignet sich besonders fuer Prompt-Treue und technische Fotografie")

---

## Implementation Slices

### Dependencies

```
Slice 1 -> Slice 2
Slice 1 -> Slice 3
Slice 1 -> Slice 4
Slice 1 -> Slice 5
```

### Slices

| # | Name | Scope | Testability | Dependencies |
|---|------|-------|-------------|--------------|
| 1 | Knowledge-Datei + Lookup | Knowledge-Datei erstellen mit allen Modell-Sektionen. Lookup-Funktion (Prefix-Matching, Modus-Filter, Fallback) fuer TS und Python | Unit-Tests: Prefix-Matching, laengster Match, Fallback, Modus-Filter | -- |
| 2 | Improver Knowledge-Injection | Improver System-Prompt mit Knowledge anreichern. generationMode als neuen Parameter durchreichen (UI -> Action -> Service) | Improver mit Flux-Modell aufrufen: System-Prompt enthaelt Flux-Tipps. Improver mit img2img-Modus: System-Prompt enthaelt img2img-Tipps | Slice 1 |
| 3 | Assistant Knowledge-Injection | Assistant System-Prompt dynamisch machen. Bildmodell + Modus als Kontext uebergeben. Prompting-Wissen injizieren | Assistant mit gewaehltem Flux-Modell: gibt Flux-spezifische Prompt-Tipps statt generischer | Slice 1 |
| 4 | Canvas Chat Knowledge-Injection | Canvas Chat System-Prompt mit Prompting-Wissen anreichern basierend auf image_context.model_id | Canvas Chat auf Flux-generiertem Bild: Prompt-Verbesserungen nutzen Flux-Staerken | Slice 1 |
| 5 | recommend_model Enhancement | Matching-Regeln mit Knowledge-Daten anreichern. Use-Case-basierte Empfehlungen | recommend_model fuer "Product Photography": empfiehlt Flux mit spezifischer Begruendung | Slice 1 |

### Recommended Order

1. **Slice 1:** Knowledge-Datei + Lookup -- Basis fuer alle anderen Slices
2. **Slice 2:** Improver -- Groesster Impact, aendert nur TypeScript-Seite
3. **Slice 3:** Assistant -- Erfordert TS-Python-Integration (Bildmodell an Backend uebergeben)
4. **Slice 4:** Canvas Chat -- Einfachste Integration (model_id existiert bereits)
5. **Slice 5:** recommend_model -- Nice-to-have, geringster Impact

---

## Context & Research

### Similar Patterns in Codebase

| Feature | Location | Relevant because |
|---------|----------|------------------|
| Canvas Chat dynamic system prompt | `backend/app/agent/canvas_graph.py:build_canvas_system_prompt()` | Bestehendes Pattern fuer dynamische System-Prompt-Injection mit Kontext |
| Model capability detection | `lib/services/capability-detection.ts` | Pattern fuer modellspezifische Logik basierend auf Model-ID |
| Model display name utility | `lib/utils/model-display-name.ts` | Pattern fuer Model-ID Transformation |
| Existing model hints in Improver | `lib/services/prompt-service.ts:buildSystemPrompt()` | Zu ersetzender Code — zeigt wo die Injection stattfindet |
| recommend_model matching rules | `backend/app/agent/tools/model_tools.py:_MATCHING_RULES` | Bestehende Regel-Struktur die erweitert wird |

### Wissensquellen

| Quelle | Abdeckung |
|--------|-----------|
| `specs/best-practices-prompting.md` | Flux 2, GPT-4o/Image 1.5, SD 3.5, Ideogram, Recraft V3, Hunyuan Image 3, allgemeine Techniken |
| Web-Recherche (abgeschlossen 2026-03-22) | Seedream 4.5/5, Nano Banana 2 |

### Web-Recherche: Seedream 4.5 / 5.0

| Aspekt | Ergebnis |
|--------|----------|
| Prompt-Stil | Natuerliche Sprache, keine Keywords. 5.0 Lite: intention-aware, Multi-Step Reasoning vor Generierung |
| Negative Prompts | Ja, unterstuetzt. 15-25 Terms max, mehr verwirrt das Modell |
| CFG Guidance | 5.5-7.5 empfohlen. Ueber 10: ~40% Uebersaettigung/Artefakte |
| Prompt-Laenge Sweet Spot | 30-100 Woerter. Unter 15: generisch. Ueber 150: Konflikte |
| Prompt-Struktur | Subject + Action/Pose + Environment/Setting + Style + Technical Details + Text Content |
| Staerken | 4K nativ, Textrendering (Poster/UI-Mockups), Character-Konsistenz, Fotografie-Terminologie |
| 5.0 Lite Besonderheiten | Web-Grounding (aktuelle Events), Spatial Reasoning, Klarheit > Keywords, Tiefenbeschreibung effektiv |
| Quellen | fal.ai, wavespeed.ai, xmode.ai, replicate.com, seed.bytedance.com |

### Web-Recherche: Nano Banana 2

| Aspekt | Ergebnis |
|--------|----------|
| Prompt-Stil | Natuerliche Sprache, detaillierte Beschreibungen. Je mehr Detail, desto naeher am Wunschbild |
| Negative Prompts | Kein separater Parameter. Semantische Negatives im Hauptprompt ("No extra fingers, avoid watermarks") |
| Referenzbilder | Bis zu 14 gleichzeitig fuer Style Transfer, Kombination, komplexe Edits |
| Staerken | Flash-Speed bei Pro-Qualitaet, Web-Search-Grounding, Textrendering, 4K Output |
| Fotografie-Terminologie | Sehr responsiv: Kameratypen (GoPro, Fujifilm), Lichtsetups ("three-point softbox"), Objektive |
| img2img | Unterstuetzt: Hintergrund aendern, Farben tauschen, Stile anpassen, Bilder kombinieren |
| Limitierung | Keine dedizierte negative_prompt API. Negatives muessen als natuerliche Sprache in den Hauptprompt |
| Quellen | Google AI Docs, Google Cloud Blog, Replicate, dev.to/googleai |

---

## Open Questions

| # | Question | Options | Recommended | Decision |
|---|----------|---------|-------------|----------|
| 1 | Seedream und Nano Banana 2 sind im Leitfaden nicht/kaum abgedeckt. Web-Recherche noetig vor Knowledge-Erstellung? | A) Ja, vor Slice 1 recherchieren B) Iterativ | A) Ja | Recherche jetzt durchfuehren (erledigt 2026-03-22) |
| 2 | Wie erhaelt der Assistant das aktuell gewaehlte Bildmodell + Modus? Aktuell wird diese Info nicht ans Backend gesendet. | A) Message-Payload B) Session-Config | A) Message-Payload | A) Message-Payload (flexibler bei Model-Wechsel) |
| 3 | Sollen auch Ideogram und Hunyuan in die erste Version aufgenommen werden? | A) Alle 8 B) Erst die 6 genannten | -- | A) Alle 8 Modell-Familien |

---

## Q&A Log

| # | Frage | Antwort |
|---|-------|---------|
| 1 | Was ist das Ziel dieser Discovery? Welches Feature soll auf Basis des Prompting-Leitfadens entwickelt werden? | Prompt-Assistent verbessern: im Improver, Assistenten und Canvas Chat fuer den jeweiligen Modus und das ausgewaehlte Modell |
| 2 | Welche Modelle aus dem Leitfaden sind fuer aifactory relevant? | Nur Replicate-Modelle: Flux 2 Familie, Nano Banana 2, GPT Image 1.5, Seedream 4.5/5, SD aktuellste, Recraft V4. Ggf. auch Ideogram und Hunyuan. |
| 3 | Wie soll das Prompting-Wissen gespeichert werden? | Zentrale Prompt-Knowledge-Datei (nicht in System-Prompts direkt, nicht in DB) |
| 4 | Wie tief soll das Wissen gehen? | Moeglichst viel Wissen verfuegbar, selektiv abrufen was noetig ist (nach Modell, Modus, Intention). Ggf. muss mehr recherchiert werden. |
| 5 | Macht RAG Sinn oder ist es overengineered? | Overengineered — deterministischer Lookup reicht (endliche Modell-Liste, klar filterbar nach Model-ID) |
| 6 | Einverstanden mit deterministischem Ansatz (Model-ID -> Lookup -> Inject)? | Ja, deterministisch |
| 7 | Soll die Knowledge-Datei neben Modell-Sektionen auch Modus-spezifische Sektionen haben? | Ja, Modell + Modus |
| 8 | Wo soll die Knowledge-Datei liegen? | Repo-Root (z.B. /data/prompt-knowledge.json) |
| 9 | Wie soll das Matching von Model-IDs zu Knowledge-Sektionen funktionieren? | Prefix-Matching (z.B. "flux-2" matcht flux-2-pro, flux-2-max) |
| 10 | Soll das Wissen im Assistant als System-Prompt oder als Tool verfuegbar sein? | System-Prompt Injection (wie Canvas Chat bereits) |
| 11 | Soll recommend_model auch verbessert werden? | Ja, auch recommend_model mit Knowledge-Daten verbessern |
| 12 | Soll die Web-Recherche fuer Seedream und Nano Banana 2 jetzt oder spaeter passieren? | Jetzt recherchieren (erledigt 2026-03-22) |
| 13 | Sollen Ideogram und Hunyuan in die erste Version aufgenommen werden? | Alle 8 Modell-Familien in die erste Version |
| 14 | Wie erhaelt der Assistant das gewaehlte Bildmodell + Modus? | Als Teil der Message-Payload (flexibler bei Model-Wechsel mid-session) |
