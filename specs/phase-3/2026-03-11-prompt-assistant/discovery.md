# Feature: Prompt Assistant

**Epic:** --
**Status:** Ready
**Wireframes:** `wireframes.md` (ausstehend)

---

## Problem & Solution

**Problem:**
- Die aktuelle "Template"-Funktion (5 hardcoded Presets) ist nutzlos — keine echte Hilfe beim Prompt-Schreiben
- Der "Prompt Builder" (Fragment-Drawer) ist ebenfalls nicht hilfreich — zu mechanisch, keine Intelligenz
- Anfänger wissen nicht, wie man gute Prompts für Bildgenerierung schreibt
- Kein geführter Prozess: User steht vor leeren Feldern (Motiv, Style, Negative) ohne Orientierung

**Solution:**
- Agent-gestützter Chat-Assistent der durch gezielte Fragen zum perfekten Prompt führt
- Canvas/Artifacts-Pattern: strukturierter Prompt wird neben dem Chat aufgebaut und ist editierbar
- Bildanalyse: User lädt Referenzbild hoch, Agent extrahiert Stil, Komposition, Mood für den Prompt
- Aktive Model-Empfehlung basierend auf Prompt-Intent

**Business Value:**
- Senkt die Einstiegshürde für Anfänger drastisch
- Höhere Prompt-Qualität = bessere Generierungsergebnisse = höhere User-Zufriedenheit
- Differenzierung gegenüber Tools die nur leere Textfelder anbieten

---

## Scope & Boundaries

| In Scope |
|----------|
| Chat-basierter Prompt-Assistent als Sheet/Drawer |
| Freie Chat-Sessions (erstellen, fortsetzen, History) |
| Canvas/Artifacts-Pattern für editierbaren Prompt |
| Bildanalyse von Referenzbildern |
| Aktive Model-Empfehlung |
| Apply-Button (Prompt in Workspace-Felder übernehmen) |
| Iterativer Loop (nach Generation zurück zum Assistenten) |
| Separates Python-Backend (FastAPI + LangGraph) |
| OpenRouter LLM-Integration (Sonnet 4.6, GPT-5.4, Gemini 3.1 Pro) |
| LangSmith Tracing |
| Deutsche Chat-Sprache, englische Prompt-Ausgabe |

| Out of Scope |
|--------------|
| Prompt-Sharing zwischen Usern |
| Team-Features / Collaboration |
| Prompt-Marketplace |
| Eigenes Model-Training |
| Voice-Input |
| Automatische Generierung (Agent löst selbst Generation aus) |

---

## Current State Reference

> Existierende Funktionalität die wiederverwendet oder ersetzt wird.

- **Template-Selector** (`components/workspace/template-selector.tsx`) — wird ENTFERNT
- **Builder-Drawer** (`components/prompt-builder/builder-drawer.tsx`) — wird ENTFERNT
- **Builder-Fragments** (`lib/builder-fragments.ts`) — wird ENTFERNT
- **Snippet-CRUD** (`app/actions/prompts.ts`: createSnippet, updateSnippet, deleteSnippet) — wird ENTFERNT
- **Prompt-Felder** (motiv, style, negativePrompt in PromptArea) — BLEIBEN, werden vom Assistenten befüllt
- **Improve Prompt** (`components/prompt-improve/llm-comparison.tsx`) — BLEIBT unverändert
- **OpenRouter Client** (`lib/clients/openrouter.ts`) — wird WIEDERVERWENDET (für LLM-Calls im Backend)
- **Image Upload** (existiert für img2img) — Pattern wird WIEDERVERWENDET für Referenzbild-Upload
- **Sheet Component** (`components/ui/sheet.tsx`) — wird WIEDERVERWENDET für Drawer
- **Model-Browser/Cards** (`components/models/`) — werden REFERENZIERT für Model-Empfehlung

---

## UI Patterns

### Reused Patterns

| Pattern Type | Component | Usage in this Feature |
|--------------|-----------|----------------------|
| Sheet/Drawer | `components/ui/sheet.tsx` | Container für den Chat-Assistenten (von rechts) |
| Button | `components/ui/button.tsx` | Trigger-Button, Apply-Button, Send-Button |
| Textarea | `components/ui/textarea.tsx` | Chat-Input |
| Skeleton | `components/ui/skeleton.tsx` | Loading States für Streaming |
| Badge | `components/ui/badge.tsx` | Suggestion-Chips auf Startscreen |

### New Patterns

| Pattern Type | Description | Rationale |
|--------------|-------------|-----------|
| Chat Thread | Scrollbare Message-Liste mit User/Assistant Bubbles | Kein Chat-Pattern existiert in der Codebase |
| Prompt Artifact Card | Strukturierte, editierbare Prompt-Karte (Canvas-Style) | Neues Interaktionsmuster: editierbares Artefakt neben Chat |
| Streaming Text | Zeichenweise Text-Anzeige während LLM-Response | SSE-basiertes Streaming, existiert nicht |
| Image Upload in Chat | Drag & Drop oder Button für Referenzbild im Chat | Existierender img2img Upload ist in PromptArea, nicht im Chat |
| Session List | Liste vergangener Chat-Sessions mit Resume-Funktion | Keine Session-Verwaltung vorhanden |

---

## Agent-Definition

> Zentrale Section: Definiert das Verhalten des Prompt-Assistenten als LangGraph Agent.

### Persönlichkeit & Ton

| Eigenschaft | Beschreibung |
|-------------|-------------|
| **Sprache** | Deutsch, freundlich, einfach verständlich — keine Fachbegriffe ohne Erklärung |
| **Ton** | Kreativer Partner, nicht Fragebogen. Inspirierend, nicht belehrend |
| **Proaktivität** | Macht eigene Vorschläge, zeigt Optionen, erklärt warum |
| **Adaptivität** | Erkennt wenn User schon weiß was er will → weniger Fragen. Erkennt Unsicherheit → mehr Führung |
| **Prompts** | Generierte Prompts immer auf Englisch (für die Modelle) |

### Phasen-Modell (nicht linear, nicht erzwungen)

Der Agent hat ein internes Tracking welche Informationen er schon hat, aber kein starres Script.

| Phase | Ziel | Agent-Verhalten | Wechsel-Trigger |
|-------|------|-----------------|-----------------|
| **Verstehen** | Was will der User? | Offene Frage oder Suggestion-Chips. Wenn Bild hochgeladen → analysieren | User nennt Motiv/Idee |
| **Erkunden** | Stil, Mood, Details klären | Vorschläge machen mit Beispielen. "Fotorealistisch oder eher illustriert?" | Must-Haves (Motiv + Stil + Zweck) bekannt |
| **Entwerfen** | Ersten Prompt-Draft erstellen | Prompt-Artefakt im Canvas anzeigen, strukturiert nach Feldern | Draft steht |
| **Verfeinern** | Prompt iterativ verbessern | User editiert im Canvas oder gibt Chat-Feedback. Agent passt an | User sagt "passt" oder klickt Apply |
| **Empfehlen** | Passendes Modell vorschlagen | Basierend auf Prompt-Inhalt Modell empfehlen mit Begründung | Kann in jeder Phase passieren |

**Kritisch:** Phasen sind ein interner Leitfaden, KEIN erzwungener Ablauf. User kann jederzeit:
- Direkt einen kompletten Prompt eingeben → Agent springt zu "Verfeinern"
- "Mach was cooles" sagen → Agent improvisiert (Verstehen überspringen)
- Mitten im Gespräch ein Bild hochladen → Agent analysiert und integriert
- Nach Apply zurückkommen → Agent nimmt den Thread wieder auf

### Must-Have Informationen (bevor Prompt-Draft möglich)

| Info | Wie der Agent sie sammelt | Fallback wenn nicht gegeben |
|------|--------------------------|----------------------------|
| **Motiv/Subjekt** | "Was möchtest du generieren?" oder aus Konversation extrahieren | Kann nicht gedraftet werden ohne |
| **Stil-Richtung** | Vorschläge anbieten: "Foto, Illustration, 3D, Abstrakt?" | Agent wählt basierend auf Motiv |
| **Zweck** | "Wofür brauchst du das Bild?" (Social Media, Web, Print, Privat) | Agent nimmt "allgemein" an |

### Tools (LangGraph)

| Tool | Beschreibung | Wann aufgerufen |
|------|-------------|-----------------|
| `analyze_image` | Vision-Model analysiert Referenzbild → extrahiert Subject, Style, Mood, Lighting, Composition, Palette als strukturiertes JSON | User lädt Bild hoch |
| `recommend_model` | Liest verfügbare Modelle aus DB/Replicate, matched gegen Prompt-Intent (Fotorealismus → Flux, Anime → SDXL, Text im Bild → Ideogram) | Agent hat genug Kontext für Empfehlung |
| `draft_prompt` | Erstellt strukturierten Prompt (motiv, style, negativePrompt) basierend auf gesammelten Infos | Must-Haves bekannt |
| `refine_prompt` | Passt bestehenden Draft an basierend auf User-Feedback | User gibt Änderungswunsch |
| `get_model_info` | Holt Details zu einem spezifischen Modell (Parameter, Stärken, Limits) | User fragt nach Modell oder Agent will empfehlen |

### System Prompt (Kernstruktur)

```
Du bist ein kreativer Prompt-Assistent für Bildgenerierung.

ROLLE:
- Du hilfst Anfängern, perfekte Prompts zu schreiben
- Du sprichst Deutsch, aber erstellst Prompts auf Englisch
- Du bist ein kreativer Partner, kein Fragebogen

VERHALTEN:
- Frage nicht alles auf einmal — eine Sache nach der anderen
- Mach Vorschläge statt nur zu fragen ("Wie wäre es mit warmem Abendlicht?")
- Wenn der User unsicher ist, biete 2-3 konkrete Optionen an
- Erkläre kurz warum du etwas vorschlägst
- Erkenne was der User schon weiß und überspringe Basics

MUST-HAVES (sammle bevor du einen Prompt erstellst):
- Motiv/Subjekt (was soll generiert werden?)
- Stil-Richtung (Foto, Illustration, 3D, etc.)
- Zweck (wofür wird das Bild gebraucht?)

PROMPT-ERSTELLUNG:
- Strukturiere den Prompt in: motiv, style, negativePrompt
- Verwende best practices: Style front-loaden, spezifische Begriffe,
  Lighting/Composition/Mood einbauen
- Negative Prompts: standard quality filters + kontextspezifisch
- Erstelle den Prompt über das draft_prompt Tool

BILDANALYSE:
- Wenn ein Bild hochgeladen wird: analysiere mit analyze_image Tool
- Extrahiere: Stil, Komposition, Farbpalette, Mood, Licht, Subjekt
- Frage den User welche Aspekte er übernehmen will
- Integriere gewählte Aspekte in den Prompt

MODEL-EMPFEHLUNG:
- Empfehle proaktiv ein Modell wenn du genug Kontext hast
- Erkläre kurz warum (1 Satz)
- Fotorealistisch → Flux
- Künstlerisch → Midjourney-style Modelle
- Text im Bild → Ideogram/Flux
- Anime/Manga → SDXL mit LoRA
```

### Empfohlene Vorschläge für Conversation Starters (Suggestion-Chips)

| Chip-Text | Interner Intent |
|-----------|-----------------|
| "Hilf mir einen Prompt zu schreiben" | Starte Verstehen-Phase mit offener Frage |
| "Analysiere ein Referenzbild" | Zeige Image-Upload, starte mit Bildanalyse |
| "Verbessere meinen aktuellen Prompt" | Lade aktuelle Prompt-Felder, starte Verfeinern |
| "Welches Modell passt zu meiner Idee?" | Starte Model-Beratung |

---

## User Flow

### Happy Path: Geführte Prompt-Erstellung

1. User klickt "Assistent"-Button in PromptArea → Sheet öffnet sich von rechts
2. Leerer Chat mit 4 Suggestion-Chips wird angezeigt
3. User klickt "Hilf mir einen Prompt zu schreiben" ODER tippt freie Nachricht
4. Agent fragt: "Was möchtest du generieren?" (wenn nicht schon gesagt)
5. User beschreibt Motiv → Agent bestätigt, fragt nach Stil-Richtung mit Vorschlägen
6. User wählt Stil → Agent fragt nach Zweck mit Optionen
7. Agent erstellt Prompt-Draft → Prompt-Artefakt erscheint im Canvas-Panel (strukturiert: Motiv, Style, Negative)
8. Agent empfiehlt Modell: "Für fotorealistische Portraits empfehle ich Flux. Soll ich das einstellen?"
9. User editiert optional im Canvas oder gibt Chat-Feedback ("Mehr dramatisches Licht")
10. Agent passt Prompt im Canvas an
11. User klickt "Apply" → Prompt-Felder im Workspace werden befüllt
12. User generiert Bild im Workspace
13. Optional: User öffnet Assistenten wieder → Chat-History ist da, User sagt "Zu dunkel, ändere den Prompt" → iterativer Loop

### Happy Path: Bildanalyse

1. User klickt "Assistent"-Button → Sheet öffnet sich
2. User klickt "Analysiere ein Referenzbild" oder lädt Bild direkt in Chat
3. Agent analysiert Bild (Streaming-Feedback: "Ich analysiere dein Bild...")
4. Agent zeigt Analyse: "Ich sehe: [Subjekt], [Stil: digitale Illustration], [Mood: dramatisch], [Licht: warmes Gegenlicht], [Palette: Orange/Violett]"
5. Agent fragt: "Welche Aspekte willst du übernehmen? Was soll anders sein?"
6. User antwortet → Agent erstellt Prompt-Draft basierend auf Analyse + User-Wünsche
7. Weiter wie Happy Path ab Schritt 7

### Happy Path: Prompt verbessern

1. User hat bereits Prompt in den Feldern stehen
2. User klickt "Assistent"-Button → Sheet öffnet sich
3. User klickt "Verbessere meinen aktuellen Prompt"
4. Agent lädt aktuelle Felder, zeigt sie im Canvas, analysiert
5. Agent macht Verbesserungsvorschläge: "Ich würde den Stil präzisieren und Lighting hinzufügen"
6. User bestätigt/modifiziert → Agent aktualisiert Canvas
7. Apply → Felder aktualisiert

### Session fortsetzen

1. User öffnet Assistenten → sieht Startscreen
2. User scrollt oder findet vergangene Session in Session-Liste
3. Klickt auf Session → Chat-History wird geladen
4. User tippt neue Nachricht → Agent setzt fort wo aufgehört wurde

**Edge Cases:**
- "Verbessere meinen aktuellen Prompt" Chip geklickt, aber alle Workspace-Felder leer → Agent antwortet: "Ich sehe noch keinen Prompt in deinem Workspace. Soll ich dir helfen, einen zu erstellen?" und leitet in die Verstehen-Phase über

**Error Paths:**
- LLM-API nicht erreichbar → Toast: "Der Assistent ist gerade nicht verfügbar. Bitte versuche es später erneut."
- Bildanalyse schlägt fehl → Chat-Nachricht: "Ich konnte das Bild leider nicht analysieren. Beschreib mir stattdessen, was du auf dem Bild siehst."
- SSE-Streaming bricht ab → Letzte vollständige Nachricht bleibt, Retry-Button erscheint
- Session konnte nicht geladen werden → Toast: "Session konnte nicht geladen werden.", neuer leerer Chat

---

## UI Layout & Context

### Screen: Assistent-Drawer (Sheet)

**Position:** Von rechts einfliegend, überlagert Gallery-Bereich
**When:** User klickt Assistent-Button in PromptArea
**Breite:** 480px (Chat-only) → 780px (wenn Canvas erscheint, animierter Übergang)

**Layout:**
- **Header:** Titel "Prompt Assistent" + Model-Selector (Dropdown: Sonnet 4.6 / GPT-5.4 / Gemini 3.1 Pro) + Session-Switcher (Button, navigiert zur Session-Liste) + Close-Button (X)
- **Main Area (Split-View wenn Artefakt existiert):**
  - **Links: Chat-Thread** (~50% Breite = ~390px im Split-View)
    - Scrollbare Message-Liste (User-Bubbles rechts, Assistant-Bubbles links)
    - Streaming-Indicator während Antwort
    - Image-Previews inline bei Bildanalyse
  - **Rechts: Prompt-Canvas** (~50% Breite = ~390px, erscheint erst wenn Draft existiert)
    - Strukturierte Felder: Motiv (Textarea), Style (Textarea), Negative Prompt (Textarea)
    - Jedes Feld direkt editierbar
    - Model-Empfehlung als klickbarer Badge/Chip unter den Feldern (Klick wählt Modell im Workspace aus)
    - "Apply"-Button (prominent, unten) — nach Klick erscheint Undo-Toast
- **Footer:** Chat-Input (Textarea + Send/Stop-Button + Image-Upload-Button)

### Screen: Startscreen (leerer Chat)

**Position:** Innerhalb des Assistent-Drawers
**When:** Neue Session oder keine aktive Session

**Layout:**
- **Center:** Willkommens-Text: "Womit kann ich dir helfen?"
- **Darunter:** 4 Suggestion-Chips in 2x2 Grid
- **Unten:** Session-History-Link ("Vergangene Sessions anzeigen") — hidden wenn keine Sessions existieren
- **Footer:** Chat-Input

### Screen: Session-Liste

**Position:** Innerhalb des Assistent-Drawers (ersetzt Chat-Ansicht)
**When:** User klickt "Vergangene Sessions anzeigen"

**Layout:**
- **Header:** "Vergangene Sessions" + Zurück-Button
- **Liste:** Chronologisch sortiert (neueste zuerst)
  - Pro Eintrag: Erster User-Message als Titel, Datum, Nachrichten-Anzahl, Prompt-Preview (falls gedraftet)
  - Klick → Session wird geladen
- **Empty State:** Zentrierte Nachricht: "Noch keine Sessions vorhanden"

---

## UI Components & States

| Element | Type | Location | States | Behavior |
|---------|------|----------|--------|----------|
| `assistant-trigger-btn` | Button (Icon: Sparkles) | PromptArea, Position des ehemaligen Builder-Buttons | `default`, `active` (Sheet offen) | Öffnet/schließt Assistent-Sheet |
| `assistant-sheet` | Sheet | Rechte Seite, überlagert Gallery | `closed`, `open` | Slide-in von rechts, 480px breit (Chat-only) → 780px (Split-View mit Canvas) |
| `chat-thread` | ScrollArea | Sheet, linke Hälfte | `empty` (Startscreen), `active` (Messages), `loading` (Streaming) | Auto-Scroll bei neuen Messages |
| `chat-input` | Textarea + Buttons | Sheet Footer | `idle`, `composing` (Text eingegeben), `composing-while-streaming` (Text eingeben während Agent streamt) | Enter = Send, Shift+Enter = Newline. Bleibt aktiv während Streaming (User kann tippen). |
| `send-btn` | Button (Icon: ArrowUp) | Chat-Input rechts | `disabled` (leer), `enabled` | Sendet Message. Wird während Streaming durch `stop-btn` ersetzt. |
| `stop-btn` | Button (Icon: Square) | Chat-Input rechts (ersetzt send-btn) | `visible` (während Streaming) | Bricht SSE-Stream ab, behält bisherigen Text als gekürzte Assistant-Message |
| `image-upload-btn` | Button (Icon: Image) | Chat-Input links | `default`, `uploading` | Öffnet File-Picker für Referenzbild |
| `suggestion-chip` | Badge/Button | Startscreen, 2x2 Grid | `default`, `hover`, `clicked` | Klick sendet vordefinierten Intent als erste Message |
| `prompt-canvas` | Card | Sheet, rechte Hälfte | `hidden` (kein Draft), `visible` (Draft existiert), `updating` (Agent ändert) | Erscheint wenn erster Draft erstellt wird |
| `canvas-motiv` | Textarea | Prompt Canvas | `readonly` (Agent schreibt), `editable` (User kann editieren) | Live-Update während Agent streamt |
| `canvas-style` | Textarea | Prompt Canvas | `readonly`, `editable` | Wie canvas-motiv |
| `canvas-negative` | Textarea | Prompt Canvas | `readonly`, `editable` | Wie canvas-motiv |
| `model-recommendation` | Badge + Text + Action | Prompt Canvas, unter Feldern | `hidden`, `visible` | Zeigt empfohlenes Modell mit kurzer Begründung. Klickbar: "Modell verwenden" wählt das empfohlene Modell direkt im Workspace aus |
| `apply-btn` | Button (primary) | Prompt Canvas, unten | `disabled` (kein Draft), `enabled` (Draft vorhanden), `applied` (zeigt Checkmark + "Applied!", reverts nach 2s) | Überträgt alle Canvas-Felder in Workspace PromptArea |
| `session-switcher` | Button | Sheet Header | `default` | Navigiert zur Session-Liste (kein Dropdown). Gleiche Aktion wie "Vergangene Sessions anzeigen" Link auf Startscreen |
| `model-selector` | Select/Dropdown | Sheet Header (zwischen Titel und Session-Switcher) | `default` | Dropdown mit 3 LLMs: Sonnet 4.6 (Default), GPT-5.4, Gemini 3.1 Pro. Auswahl wird lokal gespeichert und als `model` Parameter an Backend gesendet |
| `session-list` | List | Sheet, ersetzt Chat | `empty`, `loaded` | Klick auf Session lädt History |
| `user-message` | Chat Bubble | Chat Thread, rechts | `sent` | Blauer/violetter Hintergrund, User-Text |
| `assistant-message` | Chat Bubble | Chat Thread, links | `streaming` (Text erscheint zeichenweise), `complete` | Grauer Hintergrund, Agent-Text |
| `image-preview` | Thumbnail | Inline in User-Message | `loading`, `loaded`, `error` | Zeigt hochgeladenes Referenzbild, klickbar für Vollansicht |
| `streaming-indicator` | Dots/Pulse | Chat Thread | `active`, `hidden` | Animierte Punkte während Agent "denkt" |
| `error-message` | Chat Bubble (rot) | Chat Thread | `visible` | Fehlermeldung mit optionalem Retry-Button |
| `retry-btn` | Button | In Error-Message | `default`, `retrying` (Spinner, Text "Versuche erneut...") | Sendet letzte User-Message erneut |

---

## Feature State Machine

### States Overview

| State | UI | Available Actions |
|-------|----|--------------------|
| `sheet-closed` | Assistent nicht sichtbar, nur Trigger-Button | Trigger-Button klicken |
| `start` | Leerer Chat, Suggestion-Chips, Session-History-Link | Chip klicken, Nachricht tippen, Session-History öffnen |
| `chatting` | Chat-Thread mit Messages, kein Canvas | Nachricht senden, Bild hochladen |
| `drafting` | Chat-Thread + Canvas (Split-View), Prompt wird aufgebaut | Nachricht senden, Canvas editieren, Bild hochladen |
| `streaming` | Agent-Antwort wird zeichenweise angezeigt | Tippen (Input aktiv), Stop-Button klicken (Stream abbrechen) |
| `canvas-editing` | User editiert direkt im Canvas | Canvas-Felder bearbeiten, Apply klicken, Chat-Nachricht senden |
| `applying` | Prompt wird in Workspace-Felder übertragen | Warten (kurz) |
| `applied` | Prompt wurde übertragen, Chat zeigt Bestätigung | Sheet schließen, weiter chatten, neue Session |
| `session-list` | Liste vergangener Sessions | Session auswählen, neue Session starten, zurück |
| `loading-session` | Spinner, Session wird geladen | Warten |
| `error` | Fehlermeldung im Chat | Retry, neue Nachricht senden |

### Transitions

| Current State | Trigger | UI Feedback | Next State | Business Rules |
|---------------|---------|-------------|------------|----------------|
| `sheet-closed` | `assistant-trigger-btn` click | Sheet slide-in Animation | `start` (neue Session) oder `chatting` (letzte aktive Session) | -- |
| `start` | `suggestion-chip` click | Chip-Text als User-Message in Chat | `streaming` | Suggestion wird als HumanMessage an LangGraph gesendet |
| `start` | User tippt + `send-btn` click | User-Message erscheint in Thread | `streaming` | Neue Session wird erstellt (thread_id generiert) |
| `start` | "Vergangene Sessions" click | Übergang zu Session-Liste | `session-list` | -- |
| `chatting` | User sendet Nachricht | User-Message erscheint | `streaming` | Message wird an LangGraph Agent gesendet |
| `chatting` | User lädt Bild hoch | Bild-Preview in Chat, Upload-Progress | `streaming` | Bild wird zu Storage hochgeladen, URL an Agent |
| `streaming` | Agent-Response mit `draft_prompt` Tool-Call | Canvas Panel erscheint mit strukturiertem Prompt | `drafting` | Agent hat Must-Haves gesammelt und Prompt erstellt |
| `streaming` | Agent-Response (nur Text) | Text erscheint zeichenweise | `chatting` | -- |
| `streaming` | `stop-btn` click | Stream wird abgebrochen, bisheriger Text bleibt als gekürzte Message | `chatting` oder `drafting` (je nach vorherigem State) | SSE-Verbindung wird geschlossen |
| `streaming` | Stream-Error | Error-Message mit Retry-Button | `error` | -- |
| `drafting` | User sendet Chat-Nachricht | Message erscheint, Agent passt Canvas an | `streaming` | Agent interpretiert Feedback, ruft refine_prompt auf |
| `drafting` | User editiert Canvas-Feld | Feld-Inhalt ändert sich sofort (lokal) | `canvas-editing` | Kein API-Call, rein lokale Änderung |
| `drafting` | User klickt `apply-btn` | Felder werden in Workspace übertragen, Undo-Toast erscheint | `applied` | motiv → promptMotiv, style → promptStyle, negative → negativePrompt. Vorherige Feld-Werte werden für Undo gespeichert |
| `canvas-editing` | User klickt `apply-btn` | Felder werden in Workspace übertragen, Undo-Toast erscheint | `applied` | Wie drafting → applied |
| `canvas-editing` | User sendet Chat-Nachricht | Agent sieht aktuellen Canvas-State | `streaming` | Aktueller Canvas-Inhalt wird als Kontext mitgesendet |
| `applied` | User sendet neue Nachricht | Chat geht weiter | `streaming` | Iterativer Loop: User kann nach Generation zurückkommen |
| `applied` | User schließt Sheet | Sheet slide-out | `sheet-closed` | Session bleibt persistiert |
| `session-list` | User klickt Session | Spinner, Session wird geladen | `loading-session` | thread_id wird an LangGraph übergeben |
| `loading-session` | Session geladen | Chat-History erscheint | `chatting` oder `drafting` (wenn Draft existiert) | Checkpointer lädt State inkl. Draft |
| `loading-session` | Laden fehlgeschlagen | Toast: "Session konnte nicht geladen werden" | `start` | -- |
| `error` | `retry-btn` click | Letzte User-Message wird erneut gesendet | `streaming` | Max 3 Retries, danach permanenter Error |
| Jeder State | Close-Button (X) oder Trigger-Button | Sheet slide-out | `sheet-closed` | Session-State bleibt erhalten |
| Jeder State | `session-switcher` → "Neue Session" | Chat wird geleert, Startscreen | `start` | Neue thread_id wird generiert |

---

## Business Rules

- **Session-Persistenz:** Sessions werden über LangGraph PostgresSaver persistiert. Jede Session hat eine eindeutige `thread_id`
- **Session-Zuordnung:** Sessions sind per `project_id` in der DB gespeichert. Kein User-Auth nötig — alle Sessions eines Projekts sind sichtbar
- **Prompt-Sprache:** Chat-Kommunikation auf Deutsch, generierte Prompts immer auf Englisch
- **Must-Haves:** Agent braucht mindestens Motiv, bevor ein Draft erstellt werden kann. Stil und Zweck können vom Agent defaulted werden
- **Bildanalyse-Caching:** Ein Bild wird einmal analysiert, das Ergebnis (strukturiertes JSON) im LangGraph State gespeichert. Keine erneuten Vision-API-Calls für dasselbe Bild
- **Negative Prompts:** Agent fügt automatisch Standard-Qualitäts-Filter hinzu (z.B. "low quality, blurry, extra fingers") und erklärt dem User kurz warum. User kann sie im Canvas entfernen
- **Apply-Verhalten:** Apply überschreibt alle drei Prompt-Felder (motiv, style, negativePrompt). Leere Canvas-Felder leeren auch das Workspace-Feld. Nach Apply erscheint ein Undo-Toast (sonner) mit "Prompt übernommen. [Rückgängig]" — Klick auf Rückgängig stellt die vorherigen Feld-Werte wieder her. Toast verschwindet nach 5 Sekunden
- **Model-Empfehlung:** Empfehlung erscheint als klickbarer Badge im Canvas mit "Modell verwenden" Action-Link. Klick wählt das empfohlene Modell direkt im Workspace aus (kein Model-Browser nötig). Kein automatisches Umschalten ohne User-Interaktion
- **Session-Zuordnung:** Sessions werden per `project_id` in der DB gespeichert (nicht Browser-basiert). Alle Sessions eines Projekts sind für jeden sichtbar der das Projekt öffnet
- **LLM-Auswahl:** User wählt LLM über Dropdown im Sheet-Header: Sonnet 4.6 (Default), GPT-5.4, Gemini 3.1 Pro. Auswahl wird pro Session lokal gespeichert. Alle drei Modelle supporten Vision (Bildanalyse). Kein automatischer Fallback — bei Fehler wird Error angezeigt, User kann Modell wechseln
- **Rate Limiting:** Max 30 Messages pro Minute pro Session (schützt gegen Missbrauch)
- **Bild-Upload:** Max 1 Bild pro Message. Unterstützte Formate: JPEG, PNG, WebP. Max Dateigröße: 10 MB. Bild wird auf 1024px downscaled vor Vision-API-Call
- **Session-Limit:** Max 100 Messages pro Session. Danach: "Diese Session ist sehr lang. Starte eine neue Session für bessere Ergebnisse."
- **Retry-Logik:** Max 3 automatische Retries bei Stream-Fehlern. Danach: manueller Retry-Button

### Keyboard Interactions

| Key | Context | Action |
|-----|---------|--------|
| `Enter` | Chat-Input | Send message |
| `Shift+Enter` | Chat-Input | Newline |
| `Escape` | Sheet open | Close sheet |
| `Tab` | Sheet | Navigate: Header → Chat-Thread → Chat-Input → Image-Upload → Send/Stop |
| `Tab` | Split-View (Drafting) | Navigate: Chat-Input → Canvas-Motiv → Canvas-Style → Canvas-Negative → Apply → Chat-Input |
| `Enter` | Suggestion-Chip focused | Send chip text as message |
| `Enter` | Session-List entry focused | Load session |

**Focus Management:**
- When sheet opens → focus on chat-input
- When canvas appears (sheet expands to 780px) → focus stays on chat-input
- After Apply → focus returns to chat-input
- When session-list opens → focus on first session entry

---

## Data

### Neue DB-Tabelle: `assistant_sessions`

| Field | Required | Validation | Notes |
|-------|----------|------------|-------|
| `id` | Yes | UUID, PK | Session-ID, entspricht LangGraph thread_id |
| `project_id` | Yes | UUID, FK → projects | Zuordnung zum Projekt |
| `title` | No | varchar(255) | Auto-generiert aus erster User-Message |
| `status` | Yes | enum: "active", "archived" | Default: "active" |
| `last_message_at` | Yes | timestamp | Für Sortierung in Session-Liste |
| `message_count` | Yes | integer, default 0 | Für Session-Limit-Check |
| `has_draft` | Yes | boolean, default false | Für UI: Canvas anzeigen in Session-Liste |
| `created_at` | Yes | timestamp | -- |
| `updated_at` | Yes | timestamp | -- |

> Chat-Messages werden NICHT in einer eigenen Tabelle gespeichert. LangGraph PostgresSaver speichert den vollständigen State (inkl. Messages) als Checkpoints. Die `assistant_sessions` Tabelle dient nur als Index/Metadata.

### Neue DB-Tabelle: `assistant_images`

| Field | Required | Validation | Notes |
|-------|----------|------------|-------|
| `id` | Yes | UUID, PK | -- |
| `session_id` | Yes | UUID, FK → assistant_sessions | -- |
| `image_url` | Yes | text | S3/R2 URL des hochgeladenen Bildes |
| `analysis_result` | No | jsonb | Gecachte Vision-Analyse (subject, style, mood, etc.) |
| `created_at` | Yes | timestamp | -- |

### LangGraph State (Python, in-memory + Checkpointed)

| Field | Type | Notes |
|-------|------|-------|
| `messages` | list[BaseMessage] | Volle Chat-History (HumanMessage, AIMessage, ToolMessage) |
| `draft_prompt` | dict (motiv, style, negativePrompt) oder null | Aktueller Prompt-Draft |
| `reference_images` | list[dict] (url, analysis) | Hochgeladene Bilder + Analyse-Ergebnisse |
| `recommended_model` | dict (id, name, reason) oder null | Aktuelle Model-Empfehlung |
| `collected_info` | dict (subject, style, purpose, mood, ...) | Gesammelte Informationen aus dem Gespräch |
| `phase` | enum: understand, explore, draft, refine | Interne Phase-Tracking (für Agent-Logik) |

---

## Trigger-Inventory

| Trigger | Quelle | Aktion |
|---------|--------|--------|
| `assistant-trigger-btn` Click | User, PromptArea | Sheet öffnen/schließen |
| `suggestion-chip` Click | User, Startscreen | Intent als erste Message senden |
| Chat-Message senden | User, Chat-Input | POST an FastAPI → LangGraph invoke → SSE Stream zurück |
| Bild hochladen | User, Image-Upload-Button | Upload zu S3 → URL an LangGraph als HumanMessage mit Image |
| `apply-btn` Click | User, Prompt-Canvas | Canvas-Felder → Workspace PromptArea Felder |
| Session auswählen | User, Session-Liste | LangGraph mit thread_id laden → State + Messages wiederherstellen |
| Neue Session | User, Session-Switcher | Neue thread_id generieren, Chat leeren |
| Agent `draft_prompt` Tool-Call | Agent, LangGraph | Canvas-Panel erscheint mit strukturiertem Prompt |
| Agent `refine_prompt` Tool-Call | Agent, LangGraph | Canvas wird aktualisiert |
| Agent `analyze_image` Tool-Call | Agent, LangGraph | Vision-Model wird aufgerufen, Ergebnis im Chat + State |
| Agent `recommend_model` Tool-Call | Agent, LangGraph | Model-Badge erscheint im Canvas |
| SSE Stream Event (text-delta) | Backend, FastAPI | Text wird zeichenweise in Assistant-Message angezeigt |
| SSE Stream Event (tool-call) | Backend, FastAPI | Entsprechende UI-Aktion (Canvas update, etc.) |
| SSE Stream Error | Backend | Error-Message im Chat, Retry-Button |

---

## Implementation Slices

### Dependencies

```
Slice 1 (Python Backend Setup)
  ↓
Slice 2 (Chat UI Shell) ──→ Slice 5 (Session Management)
  ↓
Slice 3 (Core Chat Loop)
  ↓
Slice 4 (Prompt Canvas + Apply) ──→ Slice 7 (Iterativer Loop)
  ↓
Slice 6 (Bildanalyse)
  ↓
Slice 8 (Model-Empfehlung)
```

### Slices

| # | Name | Scope | Testability | Dependencies |
|---|------|-------|-------------|--------------|
| 1 | Python Backend Setup | FastAPI Server, LangGraph Graph-Grundstruktur, PostgresSaver, SSE-Endpoint, LangSmith Config, Health-Check | Backend startet, Health-Endpoint antwortet, LangSmith Trace sichtbar | -- |
| 2 | Chat UI Shell | Sheet-Component, Chat-Thread (empty state + messages), Chat-Input, Trigger-Button (ersetzt Builder-Button), Suggestion-Chips | Sheet öffnet/schließt, Suggestion-Chips sichtbar, Messages werden angezeigt | -- |
| 3 | Core Chat Loop | Frontend ↔ Backend verbinden: User-Message → SSE Stream → Assistant-Message mit Streaming-Anzeige. Agent System Prompt mit Prompt-Building-Logik | Vollständiger Roundtrip: User tippt → Agent antwortet (gestreamt) | Slice 1, Slice 2 |
| 4 | Prompt Canvas + Apply | Canvas-Panel (Split-View), strukturierte Felder (motiv, style, negative), `draft_prompt` + `refine_prompt` Tools, Apply-Button → Workspace-Felder befüllen | Agent erstellt Draft → Canvas erscheint → User klickt Apply → Workspace-Felder gefüllt | Slice 3 |
| 5 | Session Management | Session-Liste, Session erstellen/laden/fortsetzen, Session-Switcher, `assistant_sessions` DB-Tabelle, Auto-Title aus erster Message | Sessions persistieren, Session-Wechsel lädt History, neue Session startet sauber | Slice 3 |
| 6 | Bildanalyse | Image-Upload im Chat, Upload zu S3/R2, Vision-API Call (`analyze_image` Tool), Analyse-Ergebnis im Chat anzeigen, Caching in State, `assistant_images` DB-Tabelle | User lädt Bild hoch → Agent analysiert → strukturierte Analyse im Chat sichtbar → Analyse fließt in Prompt-Draft | Slice 4 |
| 7 | Iterativer Loop | Nach Apply: Session bleibt offen, User kann zurückkommen und Prompt anpassen, Canvas zeigt applied Prompt, Re-Apply möglich | User applied → generiert → öffnet Assistenten → sagt "zu dunkel" → Agent passt an → Re-Apply | Slice 4 |
| 8 | Model-Empfehlung | `recommend_model` + `get_model_info` Tools, Model-Badge im Canvas, Empfehlungslogik (Intent → Model Matching), verfügbare Modelle aus Replicate/DB | Agent empfiehlt Modell basierend auf Prompt → Badge erscheint im Canvas | Slice 4 |

### Recommended Order

1. **Slice 1:** Python Backend Setup — Fundament für alles, kann parallel zu Slice 2 entwickelt werden
2. **Slice 2:** Chat UI Shell — UI-Grundstruktur, kann parallel zu Slice 1 entwickelt werden
3. **Slice 3:** Core Chat Loop — Verbindet Frontend + Backend, erster E2E-Durchstich
4. **Slice 4:** Prompt Canvas + Apply — Kernfeature, macht den Assistenten nützlich
5. **Slice 5:** Session Management — Persistenz, wichtig für Wiederverwendbarkeit
6. **Slice 6:** Bildanalyse — Must-Have Feature, baut auf Canvas auf
7. **Slice 7:** Iterativer Loop — Verbessert UX, baut auf Apply auf
8. **Slice 8:** Model-Empfehlung — Nice-to-have, kann auch nach MVP kommen

---

## Context & Research

### Similar Patterns in Codebase

| Feature | Location | Relevant because |
|---------|----------|------------------|
| Improve Prompt (LLM Comparison) | `components/prompt-improve/llm-comparison.tsx` | Ähnliches Pattern: LLM-Call → Ergebnis anzeigen → User wählt |
| Builder Drawer | `components/prompt-builder/builder-drawer.tsx` | Wird ersetzt, aber Sheet-Pattern ist ähnlich |
| img2img Image Upload | `components/workspace/prompt-area.tsx` (Dropzone) | Upload-Pattern wiederverwendbar |
| OpenRouter Client | `lib/clients/openrouter.ts` | API-Client für LLM-Calls, Pattern für Backend-Integration |
| History Tab | `components/workspace/history-list.tsx` | Session-Liste ähnelt History-Liste |
| feedbackai-mvp Chat | `E:\WebDev\feedbackai-mvp\widget\src\` | @assistant-ui/react Pattern, SSE-Streaming, LangGraph-Integration |

### Web Research

| Source | Finding |
|--------|---------|
| Midjourney `/describe` | 4 Prompt-Varianten aus Bild generieren, User wählt — starkes UX Pattern |
| Leonardo AI | "Improve Prompt" One-Click + strukturierte Settings neben Prompt — Hybrid Approach |
| Jakob Nielsen / UX Tigers | "Prompt Augmentation" — UI Controls neben Freitext helfen bei Discoverability |
| CLIP Interrogator | Günstig ($0.0002/Bild), SD-optimierte Prompt-Vokabeln, aber weniger nuanciert als Vision-LLMs |
| GPT-4o Vision (low detail) | 85 Tokens/Bild, $0.0002/Bild — sehr günstig für Bildanalyse |
| @assistant-ui/react | Beste React Chat-UI Library für LangGraph: First-class Integration, Radix-basiert, Tailwind-kompatibel |
| LangGraph PostgresSaver | Production-ready Session-Persistenz über thread_id, automatisches Resume |
| LangGraph `interrupt()` | Human-in-the-Loop Pattern für Prompt-Review, passt zum Apply-Workflow |
| Adobe Design Guide | "Talk like an art director" — Prompts in Komposition, Licht, Material, Mood denken |
| Two-stage Image Analysis | CLIP Interrogator (günstig, SD-Vokabular) + LLM Vision (strukturiert) für optimales Ergebnis |

---

## Open Questions

| # | Question | Options | Recommended | Decision |
|---|----------|---------|-------------|----------|
| 1 | Soll der Assistent auch Negative Prompts erklären und automatisch Standard-Filter hinzufügen? | A) Ja, automatisch + erklären B) Automatisch ohne Erklärung C) Nur auf Nachfrage | A) Automatisch + erklären | **A) Ja, automatisch hinzufügen UND erklären. User kann entfernen.** |
| 2 | Brauchen wir Auth/User-Management für Sessions? Aktuell hat AI Factory keine User-Accounts | A) Sessions an Browser/Device binden B) Anonyme Sessions C) An Projekt gebunden (DB) | C) An Projekt gebunden | **C) Sessions werden per project_id in der DB gespeichert. Jeder mit Projekt-Zugang sieht alle Sessions.** |
| 3 | Soll die Sheet-Breite responsive sein oder fix 480px? | A) Fix 480px B) Responsive (min 400, max 600) C) Fullscreen auf Mobile D) Dynamisch (480px Chat-only, 780px Split-View) | D) Dynamisch | **D) 480px für Chat-only, 780px wenn Canvas erscheint (UX Review F-1)** |
| 4 | CLIP Interrogator als zusätzlichen ersten Pass bei Bildanalyse nutzen oder nur LLM Vision? | A) Nur LLM Vision (einfacher) B) CLIP + LLM (günstiger, bessere SD-Vokabeln) | A) Nur LLM Vision für MVP | **A) Nur LLM Vision via gewähltem Chat-Modell (alle 3 supporten Vision). Einfacher, ausreichend für MVP.** |
| 5 | Python-Backend: Eigenes Repo oder Monorepo mit Next.js? | A) Eigenes Repo B) Subfolder im aifactory Repo | -- | **TODO für Architecture-Agent: Optimale Repo-/Ordnerstruktur vorschlagen** |

---

## Research Log

| Date | Area | Finding |
|------|------|---------|
| 2026-03-11 | Codebase | 5 hardcoded Templates in `lib/prompt-templates.ts`, kein DB-Modell. Builder nutzt Fragments aus `lib/builder-fragments.ts` |
| 2026-03-11 | Codebase | feedbackai-mvp nutzt @assistant-ui/react v0.12.10, FastAPI + LangGraph Backend, SSE Streaming |
| 2026-03-11 | Codebase | AI Factory hat bereits OpenRouter Client, Image Upload (img2img), Sheet Component |
| 2026-03-11 | Web | @assistant-ui/react ist die beste Chat-UI Library für LangGraph (First-class Integration via @assistant-ui/react-langgraph) |
| 2026-03-11 | Web | Vercel AI SDK + AI Elements als Alternative, aber kein LangGraph-Adapter |
| 2026-03-11 | Web | CopilotKit zu schwergewichtig (5.6 MB), ChatScope falsche Zielgruppe |
| 2026-03-11 | Web | LangGraph PostgresSaver: Production-ready, automatisches Session-Resume über thread_id |
| 2026-03-11 | Web | Alle 3 Chat-Modelle (Sonnet 4.6, GPT-5.4, Gemini 3.1 Pro) supporten Vision — kein separates Vision-Modell nötig |
| 2026-03-11 | Web | CLIP Interrogator: SD-optimierte Prompt-Vokabeln, $0.0002/Bild auf Replicate |
| 2026-03-11 | Web | OpenRouter Slugs: anthropic/claude-sonnet-4.6, openai/gpt-5.4, google/gemini-3.1-pro-preview |
| 2026-03-11 | Web | Best Practice: Bild einmal analysieren → JSON cachen → alle Folge-Turns nur Text (Token-Sparen) |
| 2026-03-11 | Web | Midjourney `/describe` gibt 4 Varianten — starkes UX Pattern für Prompt-Vorschläge |
| 2026-03-11 | Web | "Prompt Augmentation" (Nielsen): UI Controls neben Freitext erhöhen Discoverability |

---

## Q&A Log

| # | Frage | Antwort |
|---|-------|---------|
| 1 | Soll ich erst recherchieren oder direkt Fragen stellen? | Erst Recherche |
| 2 | Was genau ersetzt der Prompt-Assistent? Nur die 5 hardcoded Templates, oder auch den bestehenden 'Improve Prompt' Button und/oder den 'Prompt Builder' (Fragment-Drawer)? | Templates und Builder ersetzen (beide nicht hilfreich). Improve Prompt bleibt. |
| 3 | Wo soll der Chat-Assistent in der UI leben? | Sheet/Drawer von rechts, überlagert Gallery-Bereich |
| 4 | Soll der Assistent den generierten Prompt direkt in die Prompt-Felder einfüllen können? | Prompt kann im Chat weiter verändert werden und hat einen Apply-Button. Canvas/Artifacts-Style neben dem Chat, strukturiert nach Feldern |
| 5 | Wie soll das Session-Modell funktionieren? | Freie Sessions (Chat-Threads), ähnlich ChatGPT — User kann neue Sessions starten und alte öffnen |
| 6 | Wie wichtig ist die Bildanalyse-Funktion? | Kernfeature (Must-have), muss von Anfang an dabei sein |
| 7 | Soll der Assistent auch das richtige Generierungs-Modell empfehlen? | Ja, aktiv empfehlen basierend auf Prompt-Intent |
| 8 | Backend-Architektur: Separates Python-Backend oder in Next.js integriert? | Separates Python-Backend (FastAPI + LangGraph), wie feedbackai-mvp Pattern |
| 9 | Welches LLM soll der Assistent nutzen? | OpenRouter mit Top-Modellen: anthropic/claude-sonnet-4.6, openai/gpt-5.4, google/gemini-3.1-pro-preview |
| 10 | Wie soll das Prompt-Artefakt im Chat aussehen? | Wie ChatGPT Canvas / Claude Artefakte — neben dem Chat, strukturiert nach Feldern (motiv, style, negativePrompt) |
| 11 | Wie öffnet der User den Assistenten? | Button ersetzt Template- und Builder-Button, an Position des aktuellen Builder-Buttons |
| 12 | Wer ist die primäre Zielgruppe? | Anfänger — Assistent muss stark führen, einfache Sprache |
| 13 | Wie startet eine neue Chat-Session? | Leerer Chat mit 3-4 klickbaren Suggestion-Chips |
| 14 | Soll der Assistent auch nach dem 'Apply' weiter helfen können? | Ja, iterativer Loop — User kann nach Generation zurück zum Assistenten und Prompt anpassen |
| 15 | User-Feedback: Der Agent soll kein starres Script haben | Kein vorgegebenes Script. Ein paar Must-Haves abfragen, aber dem User Raum lassen |
| 16 | Was sind die Must-Have Infos bevor der Agent einen Prompt vorschlagen kann? | Motiv + Stil-Richtung + Zweck |
| 17 | Soll der Assistent die Sprache des Users erkennen? | Immer Deutsch (Chat), Prompts auf Englisch |
| 18 | Scope-Abgrenzung: Was ist explizit OUT of scope? | Alles was nicht explizit besprochen wurde (kein Sharing, kein Marketplace, keine Team-Features) |
| 19 | Discovery-Tiefe? | Detailliert (State Machine, Edge Cases, Fehlerszenarien) |
| 20 | Soll der Assistent automatisch Standard-Negative-Prompts hinzufügen? | Ja, automatisch hinzufügen UND dem User erklären warum. User kann sie entfernen |
| 21 | Wie sollen Sessions zugeordnet werden (keine User-Accounts)? | An Projekt gebunden (DB). Sessions per project_id gespeichert, für jeden im Projekt sichtbar |
| 22 | Sheet-Breite des Assistenten-Drawers? | Fix 480px |
| 23 | CLIP Interrogator als zusätzlichen ersten Pass bei Bildanalyse? | Nein, nur LLM Vision via gewähltem Chat-Modell. Alle 3 Modelle supporten Vision. Einfacher, ausreichend für MVP |
| 24 | Python-Backend: Eigenes Repo oder Monorepo? | TODO für Architecture-Agent: Optimale Struktur vorschlagen |
