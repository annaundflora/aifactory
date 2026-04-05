# Bug: mask_url wird nicht an Canvas Agent gesendet

**Entdeckt:** 2026-04-05
**Status:** ✅ Behoben (73d772c)
**Priority:** Hoch
**Location:** `components/canvas/canvas-chat-panel.tsx:79-93`, `lib/canvas-chat-service.ts:15-23`

---

## Problembeschreibung

Wenn der User eine Maske malt und einen Prompt sendet, wird die `mask_url` NICHT im `image_context` an den Canvas Agent (Python-Backend) mitgesendet. Der Agent kann dadurch nicht erkennen, dass eine Maske vorhanden ist und routet faelschlicherweise zu einer Vollbild-Generierung statt zu `action="inpaint"`.

## Reproduktion

1. Canvas Detail View oeffnen
2. "Brush Edit" klicken, Maske malen
3. Prompt eingeben (z.B. "Replace with sunflowers")
4. Senden
5. -> Gesamtes Bild wird neu generiert (txt2img/instruction), nicht nur maskierter Bereich
6. -> Network-Request zeigt: `image_context` hat kein `mask_url` Feld

## Erwartetes Verhalten

- `mask_url` wird vor dem Senden exportiert (MaskService -> R2 Upload)
- `image_context` enthaelt `mask_url`
- Canvas Agent erkennt Maske und routet zu `action="inpaint"`
- Nur der maskierte Bereich wird veraendert

## Tatsaechliches Verhalten

- `buildImageContext()` (Zeile 79-93) baut Context OHNE `mask_url`
- `CanvasImageContext` Interface (lib/canvas-chat-service.ts:15-23) hat kein `mask_url` Feld
- Canvas Agent (Python): `image_context.get("mask_url")` ergibt `None`
- Agent-System-Prompt: "Keine Maske vorhanden" -> `action="instruction"` oder `action="generate"`
- Gesamtes Bild wird neu generiert

## Test-Evidenz

Network Request (POST /api/assistant/canvas/sessions/{id}/messages):
```json
{
  "image_context": {
    "image_url": "...",
    "prompt": "...",
    "model_id": "ideogram-ai/ideogram-v3-balanced",
    "model_params": {},
    "generation_id": "...",
    "active_model_ids": ["openai/gpt-image-1.5"]
    // ❌ KEIN mask_url!
  }
}
```

Backend CanvasImageContext DTO (canvas_sessions.py:69-72) hat `mask_url: Optional[HttpUrl]` — Feld existiert, wird aber nie befuellt.

## Root Cause Analyse

Zwei fehlende Stuecke:

1. **Frontend-Interface:** `CanvasImageContext` in `lib/canvas-chat-service.ts:15-23` hat kein `mask_url` Feld.

2. **Message-Send-Logik:** In `canvas-chat-panel.tsx:684-694` wird `contextWithModels` gebaut und an `sendCanvasMessage()` uebergeben, aber die Maske wird NICHT vorher exportiert/hochgeladen. Der Mask-Export passiert erst SPAETER in `handleCanvasGenerate` (Zeile 534) — zu spaet, da der Agent schon entschieden hat.

**Fix-Ansatz:**
1. `mask_url?: string` zu `CanvasImageContext` hinzufuegen
2. Vor `sendCanvasMessage()`: Mask exportieren, zu R2 hochladen
3. `mask_url` in `contextWithModels` einfuegen
4. `buildImageContext()` ODER die Send-Logik anpassen

## Naechste Schritte

1. [x] `CanvasImageContext` Interface um `mask_url` erweitern — `lib/canvas-chat-service.ts:23` (73d772c)
2. [x] Mask-Export + R2-Upload VOR sendCanvasMessage() ausfuehren — `canvas-chat-panel.tsx:700-707` (73d772c)
3. [x] mask_url in contextWithModels einfuegen — `canvas-chat-panel.tsx:704` (73d772c)
4. [ ] E2E-Test: Maske malen -> Prompt -> nur maskierter Bereich aendert sich
