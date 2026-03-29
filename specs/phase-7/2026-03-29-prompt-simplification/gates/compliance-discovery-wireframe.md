# Gate 0: Discovery <-> Wireframe Compliance

**Discovery:** `specs/phase-7/2026-03-29-prompt-simplification/discovery.md`
**Wireframes:** `specs/phase-7/2026-03-29-prompt-simplification/wireframes.md`
**Design Decisions:** nicht vorhanden (Phase 5 uebersprungen)
**Pruefdatum:** 2026-03-29

---

## Summary

| Status | Count |
|--------|-------|
| Pass | 16 |
| Auto-Fixed | 0 |
| Blocking | 0 |

**Verdict:** APPROVED

**100% Compliance:** Keine Warnings - alles geprueft, keine Luecken gefunden.

---

## A) Discovery -> Wireframe

### User Flow Coverage

| Discovery Flow | Steps | Wireframe Screens | Status |
|----------------|-------|-------------------|--------|
| txt2img: Type prompt -> Tools -> Generate -> Result | 3 | "Prompt Area -- After (txt2img)" zeigt Prompt-Feld, Tools-Row, Generate-Button | Pass |
| img2img: Add references -> Type prompt -> Tools -> Generate -> Result | 4 | "Prompt Area -- After (img2img)" zeigt Reference Images, Prompt-Feld, Tools-Row, Generate-Button | Pass |
| Assistant Draft: Assistant generates prompt -> User applies | 2 | "Assistant Draft Apply -- After" zeigt Draft-Block, Apply-Button | Pass |

**Anmerkung:** Die Wireframes zeigen korrekt beide Modes (txt2img, img2img) als separate Screens und den Assistant-Draft-Flow als eigenen Screen. Der "Before"-Screen dient als Referenz fuer die entfernten Felder.

### UI State Coverage

| Component | Discovery States | Wireframe States | Missing | Status |
|-----------|------------------|------------------|---------|--------|
| Prompt textarea (txt2img) | empty, typing, generating, assistant-draft | empty, typing, generating, assistant-draft | keine | Pass |
| Prompt textarea (img2img) | (gleich wie txt2img, impliziert) | nicht separat aufgelistet, aber "Same single prompt field as txt2img mode" annotiert | keine (Referenz auf txt2img) | Pass |
| Assistant Draft | composing, ready, applied | composing, ready, applied | keine | Pass |
| Style/Modifier (entfernt) | REMOVED | REMOVED (Before-Screen zeigt als Referenz) | keine | Pass |
| Negative Prompt (entfernt) | REMOVED | REMOVED (Before-Screen zeigt als Referenz) | keine | Pass |

**Anmerkung:** img2img State Variations sind nicht separat dokumentiert, aber die Annotation "Same single prompt field as txt2img mode" verweist korrekt auf die identischen States.

### Interactive Elements

| Discovery Element | Wireframe Location | Annotation | Status |
|-------------------|-------------------|------------|--------|
| Single prompt textarea (replaces Motiv+Style+Negative) | Prompt Area After (txt2img + img2img) | (1) prompt-textarea | Pass |
| Assistant button | Prompt Area After (txt2img + img2img) | (2) prompt-tools | Pass |
| Improve button | Prompt Area After (txt2img + img2img) | (2) prompt-tools | Pass |
| Clear button | Prompt Area After (txt2img + img2img) | (2) prompt-tools | Pass |
| Generate button | Prompt Area After (txt2img + img2img) | sichtbar im Wireframe | Pass |
| Apply to Prompt button (assistant) | Assistant Draft Apply | (2) apply-button | Pass |
| Draft prompt block (assistant) | Assistant Draft Apply | (1) draft-prompt | Pass |

---

## B) Wireframe -> Discovery (Rueckfluss-Check)

### Visual Specs

| Wireframe Spec | Value | In Discovery? | Status |
|----------------|-------|---------------|--------|
| Label-Aenderung "Motiv" -> "Prompt" | "Prompt *" | Nicht explizit als UI-Spec, aber impliziert durch "Nur noch ein einziges Prompt-Feld (promptMotiv)" und Scope "Label changes" ist nicht genannt | Hinweis (s.u.) |
| Placeholder-Text | "Describe your image, including style and mood..." | Nicht explizit in Discovery | Hinweis (s.u.) |
| Auto-resizing textarea | "Auto-resize textarea grows with content" | Nicht explizit in Discovery | Hinweis (s.u.) |
| Single draft block (statt 3) | "Previously showed 3 blocks... Now one unified prompt" | In Discovery: "Assistant auf 1-Feld-Output umbauen" | Pass |

### Implicit Constraints

| Wireframe Shows | Implied Constraint | In Discovery? | Status |
|-----------------|-------------------|---------------|--------|
| Label "Prompt *" (Pflichtfeld-Stern) | Prompt ist required field | Impliziert durch "promptMotiv" als einziges Feld | Pass |
| Textarea auto-resize | Frontend muss auto-resize Logik haben | Nicht explizit, aber bestehendes UI-Verhalten (kein neues Feature) | Pass |
| Placeholder "...including style and mood..." | Neuer Placeholder-Text noetig | Nicht explizit in Discovery | Hinweis (s.u.) |
| img2img: Reference Images oberhalb Prompt | Layout-Reihenfolge: References vor Prompt | Bestehendes Layout, keine Aenderung | Pass |
| Before-Screen als Referenz | Dokumentation des Ist-Zustands | Discovery hat "Ist-Zustand" Diagramm | Pass |
| Generate button disabled wenn empty | Validation: leerer Prompt blockiert Generate | Impliziert durch bestehendes Verhalten | Pass |

### Bewertung der Hinweise

Die folgenden Wireframe-Details sind NICHT in Discovery explizit dokumentiert:

1. **Label-Aenderung "Motiv" -> "Prompt"**: Die Discovery sagt "Style/Modifier und Negative Prompt UI-Felder entfernen" und "Nur noch ein einziges Prompt-Feld", aber das Label-Rename ist nicht explizit genannt.
2. **Neuer Placeholder-Text**: "Describe your image, including style and mood..." ist nur im Wireframe.
3. **Auto-resize Verhalten**: Im Wireframe als State Variation dokumentiert.

**Einordnung:** Diese Details sind UI-Mikro-Details (Label, Placeholder, Resize-Verhalten), die:
- Im bestehenden Code bereits teilweise vorhanden sind (auto-resize existiert bereits)
- Typischerweise bei der Implementation direkt aus dem Wireframe uebernommen werden
- Keine architektonischen oder Business-Logic Implikationen haben

Da diese Feature-Aenderung eine **Vereinfachung** ist (Felder entfernen, nicht hinzufuegen), und die Discovery klar das Ziel beschreibt ("Ein Prompt-Feld statt drei"), sind diese UI-Details keine fehlenden Constraints sondern normale Wireframe-Detaillierung.

**Ergebnis:** Kein Auto-Fix noetig, da kein Information-Gap besteht das die Architecture oder Implementation gefaehrden wuerde.

---

## C) Design Decisions -> Wireframe

**Uebersprungen** -- keine `design-decisions.md` vorhanden.

---

## Blocking Issues

Keine.

---

## Verdict

**Status:** APPROVED

**Blocking Issues:** 0
**Required Discovery Updates:** 0
**Required Wireframe Updates:** 0

**Begruendung:**
- Alle Discovery-User-Flows sind in Wireframes abgedeckt (txt2img, img2img, Assistant Draft)
- Alle UI-States sind dokumentiert (empty, typing, generating, assistant-draft, composing, ready, applied)
- Alle interaktiven Elemente sind visualisiert und annotiert
- Das Before/After Pattern zeigt klar was entfernt wird
- Wireframe-Details (Label, Placeholder, Auto-resize) sind UI-Mikro-Details ohne architektonische Relevanz
- Die Feature-Natur (Vereinfachung/Entfernung) minimiert das Risiko fehlender Specs

**Next Steps:**
- [ ] Weiter mit Architecture Phase
