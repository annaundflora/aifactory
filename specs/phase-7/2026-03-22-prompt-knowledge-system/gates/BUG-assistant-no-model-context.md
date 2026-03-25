# Bug: Assistant erhaelt kein Modell-Kontext beim ersten Oeffnen

**Entdeckt:** 2026-03-24
**Status:** Neu
**Priority:** Hoch
**Location:** `lib/assistant/assistant-context.tsx:374`

---

## Problembeschreibung

Der Assistant bekommt das aktuell im Workspace ausgewaehlte Bildmodell nicht mitgeteilt. Er fragt "welches Modell meinst du?" obwohl der User bereits ein Modell (z.B. GPT Image 1.5) ausgewaehlt hat.

## Root Cause

`imageModelIdRef` wird aus `variationData?.modelId` gespeist (Zeile 374):

```tsx
imageModelIdRef.current = variationData?.modelId ?? null;
```

Aber `variationData` ist initial `null` und wird erst durch `setVariation()` befuellt. `setVariation()` wird im Produktionscode **nur** in `assistant-context.tsx` selbst aufgerufen — und zwar nur beim Apply-Flow (Zeilen 504, 522, 544).

Es gibt **keinen** `setVariation()`-Aufruf in den Workspace-Komponenten (`prompt-area.tsx`, Model-Dropdown, etc.). Das heisst: Das aktuell im Dropdown ausgewaehlte Modell fliesst NICHT in `variationData` ein.

## Reproduktion

1. Oeffne acfactory.uk
2. Waehle ein Bildmodell im Workspace (z.B. GPT Image 1.5)
3. Oeffne den Assistant
4. Frage "Wie schreibe ich gute Prompts fuer dieses Modell?"
5. Der Assistant fragt zurueck welches Modell gemeint ist

## Erwartetes Verhalten

- Der Assistant erkennt das gewaehlte Modell und gibt modellspezifische Tipps
- `image_model_id` wird im POST Body an das Backend gesendet

## Tatsaechliches Verhalten

- `variationData` ist `null` -> `imageModelIdRef.current` ist `null`
- `image_model_id` fehlt im Request -> Backend baut System-Prompt ohne Knowledge
- Assistant hat keinen Modell-Kontext

## Test-Evidenz

- Code-Analyse: `setVariation()` wird nur in `lib/assistant/assistant-context.tsx` aufgerufen (Apply-Flow), nicht bei Modell-Auswahl im Workspace
- Manueller Test: Assistant fragt nach Modell obwohl GPT Image 1.5 ausgewaehlt war

## Fix-Vorschlag

Der `imageModelIdRef` sollte nicht aus `variationData` gespeist werden, sondern direkt aus dem aktuellen Workspace-State. Optionen:

1. **Eigener Ref in prompt-area.tsx**: Den aktuell ausgewaehlten `selectedModelId` per Ref an den Assistant-Context weitergeben
2. **Workspace-State erweitern**: `setVariation()` auch bei Modell-Wechsel aufrufen (nicht nur bei Apply)
3. **Separater Context/Prop**: Einen eigenen Mechanismus fuer die aktuelle Modell-Auswahl einfuehren

Option 1 ist am wenigsten invasiv.

## Naechste Schritte

1. [ ] Fix: imageModelIdRef aus aktuellem Workspace-Modell speisen statt aus variationData
2. [ ] Fix: generationModeRef analog pruefen (gleicher Bug wahrscheinlich)
3. [ ] Regressionstest: Assistant mit ausgewaehltem Modell testen
