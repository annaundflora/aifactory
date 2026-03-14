# Bug: In-Place Generation aktualisiert Bild nicht ohne Reload

**Entdeckt:** 2026-03-14
**Status:** 🔴 Neu
**Priority:** 🔴 Hoch (Core Feature broken)
**Location:** `components/canvas/canvas-detail-view.tsx:87-92,145-206`

---

## Problembeschreibung

Generation wird korrekt gestartet (Replicate Dashboard bestaetigt), aber das Bild in der Canvas-Detail-View aktualisiert sich nicht. Erst nach einem Page-Reload ist das neue Bild sichtbar.

**Root Cause:** Data-Flow-Luecke zwischen Canvas-Polling und dem `allGenerations`-Array.

### Detaillierte Analyse

1. Canvas-Detail-View ruft `generateImages()` Server Action auf → erhaelt pending Generation-IDs
2. Canvas-internes Polling (`fetchGenerations(projectId)`, Zeile 145) erkennt Completion
3. Dispatcht `PUSH_UNDO` → `currentGenerationId` wechselt auf die neue ID
4. **Problem:** `currentGeneration` Memo (Zeile 87-92) sucht in `allGenerations`:
   ```tsx
   const currentGeneration = useMemo(() => {
     return (
       allGenerations.find((g) => g.id === state.currentGenerationId) ??
       generation
     );
   }, [allGenerations, state.currentGenerationId, generation]);
   ```
5. `allGenerations` ist `completedGenerations` aus `workspace-content.tsx` — wird vom Canvas-Polling NICHT aktualisiert
6. `allGenerations.find()` liefert `undefined` fuer die neue Generation
7. Fallback `?? generation` zeigt das Original-Bild (unveraendert)

### Warum der Reload funktioniert
Beim Reload laedt `workspace-content.tsx` alle Generationen frisch vom Server, die neue Generation ist dann in `allGenerations` enthalten.

## Reproduktion

1. Oeffne Detail-View
2. Klicke Variation → Generate
3. Warte bis Generation abgeschlossen (Replicate Dashboard zeigt "completed")
4. Beobachte: Bild aendert sich NICHT
5. Lade Seite neu → Neues Bild ist da

## Erwartetes Verhalten

- Nach abgeschlossener Generation: Neues Bild erscheint im Canvas
- Loading-Overlay verschwindet
- Altes Bild wandert auf Undo-Stack

## Tatsaechliches Verhalten

- Bild bleibt unveraendert (zeigt Original)
- State wechselt (`currentGenerationId` neu), aber kein sichtbares Update

## Loesungsansatz

**Option A (minimal):** Canvas-Polling aktualisiert `allGenerations` via Callback:
```tsx
// workspace-content.tsx
<CanvasDetailView
  ...
  onGenerationsUpdated={(gens) => setGenerations(gens)}
/>
```

**Option B (besser):** Canvas-Detail-View verwaltet eigene lokale Generations-Liste. Polling-Ergebnis aktualisiert sowohl die lokale Liste als auch den Context-State.

**Option C (sauberste):** `fetchGenerations`-Ergebnis wird im Canvas-Polling-Effect genutzt, um eine lokale `generations`-Map zu pflegen. `currentGeneration` Memo nutzt diese Map statt `allGenerations`.

## Naechste Schritte

1. [ ] Architektur-Entscheidung: Callback vs. lokale State vs. Map
2. [ ] Canvas-Polling-Ergebnis muss `allGenerations` oder lokale Alternative aktualisieren
3. [ ] Testen: Generation erzeugt neues Bild in-place, Undo funktioniert
